import { describe, expect, it, vi } from "vitest";
import { encodeActivation } from "../notifications/activation";
import type { TauriPort } from "../notifications/tauri-port";
import type { OsActivation } from "../notifications/types";
import {
	isNotificationLink,
	openNotificationLink,
	parseNotificationLink,
	parsePushActivation,
	pushActivations,
} from "./activation";
import { listenForApnsActivations } from "./apns";
import {
	createMarkReadDrain,
	type MarkReadBridge,
	type MarkReadTarget,
} from "./mark-read";
import { listenForWorkerActivations, type PushWorkers } from "./web";

const CHANNEL =
	"at://did:plc:hq/space/social.colibri.beta.channel.text/general";
const THREAD = "at://did:plc:hq/space/social.colibri.beta.channel.thread/plans";
const MESSAGE = `${CHANNEL}/did:plc:ada/social.colibri.beta.message/m1`;
const THREAD_MESSAGE = `${THREAD}/did:plc:ada/social.colibri.beta.message/m2`;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("parsePushActivation", () => {
	it("maps an APNs tap to the channel and message", () => {
		expect(
			parsePushActivation({ channelUri: CHANNEL, messageUri: MESSAGE }),
		).toEqual({ channel: CHANNEL, rkey: "m1" });
	});

	it("finds the thread from the message when the payload has none", () => {
		expect(
			parsePushActivation({ channelUri: CHANNEL, messageUri: THREAD_MESSAGE }),
		).toEqual({ channel: CHANNEL, thread: THREAD, rkey: "m2" });
	});

	it("reads service worker messages with an explicit thread", () => {
		expect(
			parsePushActivation({
				type: "colibri-notification-activated",
				channelUri: CHANNEL,
				threadUri: THREAD,
				messageUri: THREAD_MESSAGE,
			}),
		).toEqual({ channel: CHANNEL, thread: THREAD, rkey: "m2" });
	});

	it("ignores payloads it can't route", () => {
		expect(parsePushActivation(null)).toBeUndefined();
		expect(parsePushActivation({ channelUri: "general" })).toBeUndefined();
		expect(parsePushActivation({ channelUri: THREAD })).toBeUndefined();
		expect(
			parsePushActivation({ channelUri: CHANNEL, messageUri: "nope" }),
		).toEqual({ channel: CHANNEL });
	});
});

describe("notification deep links", () => {
	const link = (params: Record<string, string>) =>
		`social.colibri:/notification?${new URLSearchParams(params).toString()}`;

	it("parses the Android tap link", () => {
		expect(
			parseNotificationLink(
				link({ channel: CHANNEL, thread: THREAD, message: THREAD_MESSAGE }),
			),
		).toEqual({ channel: CHANNEL, thread: THREAD, rkey: "m2" });
	});

	it("accepts the host form of the link", () => {
		expect(
			parseNotificationLink(
				`social.colibri://notification?channel=${encodeURIComponent(CHANNEL)}`,
			),
		).toEqual({ channel: CHANNEL });
	});

	it("leaves sign-in callbacks alone", () => {
		expect(
			isNotificationLink("social.colibri:/oauth/callback?state=a&code=b"),
		).toBe(false);
		expect(isNotificationLink("not a url")).toBe(false);
	});

	it("routes a link through the shared activation bus", () => {
		const seen: OsActivation[] = [];
		const stop = pushActivations.subscribe((activation) =>
			seen.push(activation),
		);
		expect(openNotificationLink(link({ channel: CHANNEL }))).toBe(true);
		expect(openNotificationLink(link({ channel: "bad" }))).toBe(true);
		expect(openNotificationLink("https://colibri.social/app")).toBe(false);
		stop();
		expect(seen).toEqual([{ channel: CHANNEL }]);
	});
});

const fakePort = (launch: unknown) => {
	let handler: ((event: { payload: unknown }) => void) | undefined;
	const port: TauriPort = {
		invoke: async <T>() => launch as T,
		listen: async <T>(
			_event: string,
			listener: (event: { payload: T }) => void,
		) => {
			handler = listener as (event: { payload: unknown }) => void;
			return () => {
				handler = undefined;
			};
		},
	};
	return { port, fire: (payload: unknown) => handler?.({ payload }) };
};

describe("APNs activations", () => {
	it("uses the thread the shell reports", async () => {
		const { port } = fakePort({
			channelUri: CHANNEL,
			threadUri: THREAD,
			messageUri: THREAD_MESSAGE,
		});
		const seen: OsActivation[] = [];
		listenForApnsActivations(port, (activation) => seen.push(activation));
		await flush();
		expect(seen).toEqual([{ channel: CHANNEL, thread: THREAD, rkey: "m2" }]);
	});

	it("routes the launch tap and later taps once each", async () => {
		const { port, fire } = fakePort({
			channelUri: CHANNEL,
			messageUri: MESSAGE,
		});
		const seen: OsActivation[] = [];
		const stop = listenForApnsActivations(port, (activation) =>
			seen.push(activation),
		);
		await flush();
		fire({ channelUri: CHANNEL, messageUri: MESSAGE });
		fire({ channelUri: CHANNEL, messageUri: THREAD_MESSAGE });
		stop();
		expect(seen).toEqual([
			{ channel: CHANNEL, rkey: "m1" },
			{ channel: CHANNEL, thread: THREAD, rkey: "m2" },
		]);
	});

	it("leaves local banner taps to the native notifier", async () => {
		const { port, fire } = fakePort(null);
		const seen: OsActivation[] = [];
		listenForApnsActivations(port, (activation) => seen.push(activation));
		await flush();
		fire({
			channelUri: CHANNEL,
			messageUri: encodeActivation({
				title: "Ada",
				body: "hi",
				channel: CHANNEL,
				authorDid: "did:plc:ada",
			}),
		});
		expect(seen).toEqual([]);
	});
});

describe("service worker activations", () => {
	it("routes notification clicks from the worker", () => {
		let listener: ((event: Event) => void) | undefined;
		const workers = {
			addEventListener: (_: string, next: (event: Event) => void) => {
				listener = next;
			},
			removeEventListener: () => {
				listener = undefined;
			},
		} as unknown as PushWorkers;
		const seen: OsActivation[] = [];
		const stop = listenForWorkerActivations(workers, (activation) =>
			seen.push(activation),
		);
		listener?.({
			data: {
				type: "colibri-notification-activated",
				channelUri: CHANNEL,
				messageUri: MESSAGE,
			},
		} as unknown as Event);
		listener?.({
			data: { type: "colibri-push-subscription-changed" },
		} as unknown as Event);
		stop();
		expect(seen).toEqual([{ channel: CHANNEL, rkey: "m1" }]);
	});
});

describe("pending mark read", () => {
	const bridge = (entries: unknown): MarkReadBridge & { acked: string[] } => {
		const acked: string[] = [];
		return {
			acked,
			pendingMarkRead: () =>
				typeof entries === "string" ? entries : JSON.stringify(entries),
			ackMarkRead: (channelUri) => acked.push(channelUri),
		};
	};

	it("marks each channel read through the message and acknowledges it", async () => {
		const actions = bridge([
			{ channelUri: CHANNEL, messageUri: THREAD_MESSAGE, actionedAt: 1 },
			{ channelUri: CHANNEL, actionedAt: 2 },
			{ channelUri: CHANNEL, threadUri: THREAD, actionedAt: 3 },
			{ channelUri: "", actionedAt: 4 },
		]);
		const targets: MarkReadTarget[] = [];
		const drain = createMarkReadDrain({
			bridge: () => actions,
			markRead: async (target) => {
				targets.push(target);
			},
		});
		await drain();
		expect(targets).toEqual([
			{ space: THREAD, rkey: "m2" },
			{ space: CHANNEL },
			{ space: THREAD },
		]);
		expect(actions.acked).toEqual([CHANNEL, CHANNEL, THREAD]);
	});

	it("keeps an entry queued when marking it read fails", async () => {
		const actions = bridge([{ channelUri: CHANNEL, actionedAt: 1 }]);
		const drain = createMarkReadDrain({
			bridge: () => actions,
			markRead: vi.fn(async () => {
				throw new Error("offline");
			}),
		});
		await drain();
		expect(actions.acked).toEqual([]);
	});

	it("survives a malformed queue and a missing bridge", async () => {
		const markRead = vi.fn(async () => {});
		await createMarkReadDrain({
			bridge: () => bridge("{not json"),
			markRead,
		})();
		await createMarkReadDrain({ bridge: () => undefined, markRead })();
		expect(markRead).not.toHaveBeenCalled();
	});
});

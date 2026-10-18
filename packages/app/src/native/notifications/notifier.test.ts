import { describe, expect, it, vi } from "vitest";
import {
	createActivationBus,
	decodeActivation,
	encodeActivation,
} from "./activation";
import { resolveNotifier } from "./index";
import { createNativeNotifier } from "./native";
import {
	type ActivationMemory,
	createActivationMemory,
	createPluginNotifier,
	notificationId,
	type PluginAction,
	type RememberedActivations,
} from "./plugin";
import type { TauriPort } from "./tauri-port";
import type { OsActivation, OsNotification } from "./types";

const CHANNEL =
	"at://did:plc:hq/space/social.colibri.beta.channel.text/general";
const THREAD = "at://did:plc:hq/space/social.colibri.beta.channel.thread/plans";

const notification = (
	overrides: Partial<OsNotification> = {},
): OsNotification => ({
	title: "Ada",
	subtitle: "Mentioned you · HQ › #general",
	body: "hey, look at this",
	channel: CHANNEL,
	rkey: "m1",
	authorDid: "did:plc:ada",
	...overrides,
});

const fakePort = (
	responses: Record<string, unknown> = {},
): TauriPort & {
	calls: { command: string; args?: Record<string, unknown> }[];
	fire: (event: string, payload: unknown) => void;
} => {
	const calls: { command: string; args?: Record<string, unknown> }[] = [];
	const listeners = new Map<string, (event: { payload: unknown }) => void>();
	return {
		calls,
		invoke: async <T>(command: string, args?: Record<string, unknown>) => {
			calls.push({ command, ...(args ? { args } : {}) });
			const response = responses[command];
			if (response instanceof Error) throw response;
			return response as T;
		},
		listen: async <T>(
			event: string,
			handler: (event: { payload: T }) => void,
		) => {
			listeners.set(event, handler as (event: { payload: unknown }) => void);
			return () => listeners.delete(event);
		},
		fire: (event, payload) => listeners.get(event)?.({ payload }),
	};
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const memoryOf = (): ActivationMemory => {
	const entries = new Map<number, string>();
	return {
		remember: (id, key) => {
			entries.set(id, key);
		},
		recall: (id) => entries.get(id),
	};
};

describe("activation keys", () => {
	it("round-trips the channel, thread and message", () => {
		const key = encodeActivation(notification({ thread: THREAD }));
		expect(decodeActivation(key)).toEqual({
			channel: CHANNEL,
			thread: THREAD,
			rkey: "m1",
		});
	});

	it("falls back to the channel for keys from elsewhere", () => {
		expect(decodeActivation("some-push-id", CHANNEL)).toEqual({
			channel: CHANNEL,
		});
		expect(decodeActivation("some-push-id", "not-a-uri")).toBeUndefined();
	});

	it("buffers an activation until someone listens", () => {
		const bus = createActivationBus();
		bus.emit({ channel: CHANNEL });
		const seen: OsActivation[] = [];
		bus.subscribe((activation) => seen.push(activation));
		expect(seen).toEqual([{ channel: CHANNEL }]);
	});

	it("drops a buffered activation on discard", () => {
		const bus = createActivationBus();
		bus.emit({ channel: CHANNEL });
		bus.discard();
		const seen: OsActivation[] = [];
		bus.subscribe((activation) => seen.push(activation));
		expect(seen).toEqual([]);
	});
});

describe("plugin notifier", () => {
	it("maps the plugin permission states", async () => {
		expect(
			await createPluginNotifier(
				fakePort({ "plugin:notification|is_permission_granted": true }),
			).permission(),
		).toBe("granted");
		expect(
			await createPluginNotifier(
				fakePort({ "plugin:notification|is_permission_granted": null }),
			).permission(),
		).toBe("default");
		expect(
			await createPluginNotifier(
				fakePort({ "plugin:notification|request_permission": "denied" }),
			).requestPermission(),
		).toBe("denied");
	});

	it("posts one notification per conversation and dismisses it by id", async () => {
		const port = fakePort();
		const notifier = createPluginNotifier(
			port,
			createActivationBus(),
			async () => () => {},
			memoryOf(),
		);
		const shown = notification({ thread: THREAD });
		await notifier.show(shown);
		await notifier.dismiss(THREAD);
		expect(port.calls).toEqual([
			{
				command: "plugin:notification|notify",
				args: {
					options: {
						id: notificationId(THREAD),
						title: "Ada",
						body: "Mentioned you · HQ › #general\nhey, look at this",
						group: THREAD,
						autoCancel: true,
						extra: { activation: encodeActivation(shown) },
					},
				},
			},
			{
				command: "plugin:notification|remove_active",
				args: { notifications: [{ id: notificationId(THREAD) }] },
			},
		]);
	});

	it("matches the Java string hash", () => {
		expect(notificationId("abc")).toBe(96354);
	});

	it("opens the conversation from the payload of a tapped notification", async () => {
		let tap: ((action: PluginAction) => void) | undefined;
		const notifier = createPluginNotifier(
			fakePort(),
			createActivationBus(),
			async (handler) => {
				tap = handler;
				return () => {};
			},
			memoryOf(),
		);
		const seen: OsActivation[] = [];
		notifier.onActivation((activation) => seen.push(activation));
		await flush();
		tap?.({
			actionId: "tap",
			notification: {
				id: notificationId(THREAD),
				group: THREAD,
				extra: {
					activation: encodeActivation(notification({ thread: THREAD })),
				},
			},
		});
		tap?.({
			actionId: "dismiss",
			notification: { extra: { activation: encodeActivation(notification()) } },
		});
		expect(seen).toEqual([{ channel: CHANNEL, thread: THREAD, rkey: "m1" }]);
	});

	it("finds the conversation by id when the tap carries no payload", async () => {
		let tap: ((action: PluginAction) => void) | undefined;
		const memory = memoryOf();
		const notifier = createPluginNotifier(
			fakePort(),
			createActivationBus(),
			async (handler) => {
				tap = handler;
				return () => {};
			},
			memory,
		);
		const seen: OsActivation[] = [];
		notifier.onActivation((activation) => seen.push(activation));
		await notifier.show(notification({ rkey: "m7" }));
		tap?.({ actionId: "tap", notification: { id: notificationId(CHANNEL) } });
		tap?.({ actionId: "tap", notification: { id: 42 } });
		expect(seen).toEqual([{ channel: CHANNEL, rkey: "m7" }]);
	});

	it("opens the conversation of the tap that launched the app once", async () => {
		const launchTap = JSON.stringify({
			actionId: "tap",
			notification: {
				id: notificationId(THREAD),
				group: THREAD,
				extra: {
					activation: encodeActivation(notification({ thread: THREAD })),
				},
			},
		});
		const takeLaunchTap = vi
			.fn<() => string | undefined>()
			.mockReturnValueOnce(launchTap)
			.mockReturnValue("");
		const notifier = createPluginNotifier(
			fakePort(),
			createActivationBus(),
			async () => () => {},
			memoryOf(),
			takeLaunchTap,
		);
		const seen: OsActivation[] = [];
		notifier.onActivation((activation) => seen.push(activation));
		notifier.onActivation((activation) => seen.push(activation));
		await notifier.show(notification());
		expect(takeLaunchTap).toHaveBeenCalledTimes(1);
		expect(seen).toEqual([{ channel: CHANNEL, thread: THREAD, rkey: "m1" }]);
	});

	it("ignores an empty, malformed or non-tap launch action", () => {
		for (const raw of [
			undefined,
			"",
			"not json",
			"null",
			JSON.stringify({
				actionId: "dismiss",
				notification: {
					extra: { activation: encodeActivation(notification()) },
				},
			}),
		]) {
			const notifier = createPluginNotifier(
				fakePort(),
				createActivationBus(),
				async () => () => {},
				memoryOf(),
				() => raw,
			);
			const seen: OsActivation[] = [];
			notifier.onActivation((activation) => seen.push(activation));
			expect(seen).toEqual([]);
		}
	});

	it("keeps a bounded memory of shown notifications across restarts", () => {
		let stored: RememberedActivations | undefined;
		const open = () =>
			createActivationMemory(
				() => stored,
				(entries) => {
					stored = entries;
				},
			);
		const first = open();
		for (let id = 0; id < 60; id++) first.remember(id, `key-${id}`);
		const second = open();
		expect(second.recall(59)).toBe("key-59");
		expect(second.recall(10)).toBe("key-10");
		expect(second.recall(9)).toBeUndefined();
	});
});

describe("native notifier", () => {
	it("caches the avatar once and sends the subtitle separately", async () => {
		const port = fakePort({
			native_notify_cache_avatar: "/cache/ada.jpg",
			native_notify_take_activation: null,
		});
		const fetchBytes = vi.fn(async () => new Uint8Array([1, 2]).buffer);
		const notifier = createNativeNotifier(
			port,
			createActivationBus(),
			fetchBytes,
		);
		const payload = notification({ avatar: "https://cdn.test/ada.jpg" });
		await notifier.show(payload);
		await notifier.show(payload);
		expect(fetchBytes).toHaveBeenCalledTimes(1);
		const shows = port.calls.filter((call) => call.command === "native_notify");
		expect(shows[0]?.args).toEqual({
			payload: {
				title: "Ada",
				body: "hey, look at this",
				subtitle: "Mentioned you · HQ › #general",
				channelUri: CHANNEL,
				messageUri: encodeActivation(payload),
				iconPath: "/cache/ada.jpg",
			},
		});
		expect(
			port.calls.find((call) => call.command === "native_notify_cache_avatar")
				?.args,
		).toEqual({ cid: "did:plc:ada", bytes: [1, 2] });
	});

	it("routes clicks and the launch activation once each", async () => {
		const launch = encodeActivation(notification({ thread: THREAD }));
		const port = fakePort({
			native_notify_take_activation: {
				channelUri: THREAD,
				messageUri: launch,
			},
		});
		const notifier = createNativeNotifier(port, createActivationBus());
		const seen: OsActivation[] = [];
		notifier.onActivation((activation) => seen.push(activation));
		await flush();
		port.fire("colibri-notification-activated", {
			channelUri: THREAD,
			messageUri: launch,
		});
		port.fire("colibri-notification-activated", {
			channelUri: CHANNEL,
			messageUri: encodeActivation(notification({ rkey: "m2" })),
		});
		expect(seen).toEqual([
			{ channel: CHANNEL, thread: THREAD, rkey: "m1" },
			{ channel: CHANNEL, rkey: "m2" },
		]);
	});
});

describe("resolveNotifier", () => {
	it("uses the plugin on mobile", async () => {
		const notifier = await resolveNotifier({
			tauri: true,
			mobile: true,
			port: fakePort(),
		});
		expect(notifier.kind).toBe("plugin");
	});

	it("uses native notifications on desktop when the wrapper supports them", async () => {
		expect(
			(
				await resolveNotifier({
					tauri: true,
					mobile: false,
					port: fakePort({ native_notify_supported: true }),
				})
			).kind,
		).toBe("native");
		expect(
			(
				await resolveNotifier({
					tauri: true,
					mobile: false,
					port: fakePort({ native_notify_supported: new Error("missing") }),
				})
			).kind,
		).toBe("plugin");
	});

	it("has nothing to offer without the Notification API", async () => {
		expect((await resolveNotifier({ tauri: false })).kind).toBe("none");
	});
});

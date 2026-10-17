import { describe, expect, it, vi } from "vitest";
import {
	createActivationBus,
	decodeActivation,
	encodeActivation,
} from "./activation";
import { resolveNotifier } from "./index";
import { createNativeNotifier } from "./native";
import { createPluginNotifier, notificationId } from "./plugin";
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
		const notifier = createPluginNotifier(port);
		await notifier.show(notification({ thread: THREAD }));
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

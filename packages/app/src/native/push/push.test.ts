import { describe, expect, it, vi } from "vitest";
import type { PushRegistration, PushUnregistration } from "../../data/source";
import type { TauriPort } from "../notifications/tauri-port";
import { createApnsProvider } from "./apns";
import { createFcmProvider } from "./fcm";
import { createPush, teardownLeftoverPush } from "./index";
import {
	createReadSweep,
	type ReadSweepStore,
	readTargets,
} from "./read-sweep";
import type { PushPort, PushProvider, StoredValue } from "./types";
import { createWebPushProvider, type PushWorkers } from "./web";

const memory = (initial?: string): StoredValue => {
	let value = initial;
	return {
		get: () => value,
		set: (next) => {
			value = next;
		},
	};
};

const fakeApi = (options: { failRegister?: boolean } = {}) => {
	const registered: PushRegistration[] = [];
	const unregistered: PushUnregistration[] = [];
	return {
		registered,
		unregistered,
		registerPush: vi.fn(async (input: PushRegistration) => {
			if (options.failRegister) throw new Error("appview down");
			registered.push(input);
		}),
		unregisterPush: vi.fn(async (input: PushUnregistration) => {
			unregistered.push(input);
		}),
	};
};

const fakePort = (
	responses: Record<string, unknown> = {},
): PushPort & {
	calls: { command: string; args?: Record<string, unknown> }[];
	refresh: () => void;
} => {
	const calls: { command: string; args?: Record<string, unknown> }[] = [];
	let refreshHandler: ((payload: unknown) => void) | undefined;
	return {
		calls,
		invoke: async <T>(command: string, args?: Record<string, unknown>) => {
			calls.push({ command, ...(args ? { args } : {}) });
			const response = responses[command];
			if (response instanceof Error) throw response;
			return response as T;
		},
		listen: async () => () => {},
		pluginListener: async (_plugin, _event, handler) => {
			refreshHandler = handler;
			return () => {
				refreshHandler = undefined;
			};
		},
		refresh: () => refreshHandler?.({ token: "next" }),
	};
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("APNs", () => {
	it("registers the device token with its environment", async () => {
		const api = fakeApi();
		const token = memory();
		const provider = createApnsProvider({
			port: fakePort({
				apns_register: { token: "ab12", environment: "sandbox" },
			}),
			platform: "ios",
			token,
		});
		expect(await provider.subscribe(api)).toBe(true);
		expect(api.registered).toEqual([
			{
				provider: "apns",
				platform: "ios",
				token: "ab12",
				environment: "sandbox",
			},
		]);
		expect(token.get()).toBe("ab12");
	});

	it("unregisters the previous token when the device token changes", async () => {
		const api = fakeApi();
		const provider = createApnsProvider({
			port: fakePort({
				apns_register: { token: "new", environment: "production" },
			}),
			platform: "macos",
			token: memory("old"),
		});
		await provider.subscribe(api);
		expect(api.unregistered).toEqual([{ provider: "apns", token: "old" }]);
		expect(api.registered[0]).toMatchObject({
			platform: "macos",
			token: "new",
		});
	});

	it("falls back quietly without the push entitlement", async () => {
		const api = fakeApi();
		const provider = createApnsProvider({
			port: fakePort({ apns_register: new Error("no aps-environment") }),
			platform: "macos",
			token: memory(),
		});
		expect(await provider.subscribe(api)).toBe(false);
		expect(api.registerPush).not.toHaveBeenCalled();
	});

	it("forgets and unregisters the cached token", async () => {
		const api = fakeApi();
		const token = memory("cached");
		const provider = createApnsProvider({
			port: fakePort(),
			platform: "ios",
			token,
		});
		expect(await provider.hasLeftover()).toBe(true);
		await provider.unsubscribe(api);
		expect(api.unregistered).toEqual([{ provider: "apns", token: "cached" }]);
		expect(token.get()).toBeUndefined();
	});

	it("removes delivered notifications for a channel", async () => {
		const port = fakePort();
		const provider = createApnsProvider({
			port,
			platform: "ios",
			token: memory(),
		});
		await provider.dismiss("at://did:plc:hq/space/t/general");
		await provider.dismiss(undefined);
		expect(port.calls).toEqual([
			{
				command: "apns_remove_delivered",
				args: { channelUri: "at://did:plc:hq/space/t/general" },
			},
		]);
	});
});

describe("FCM", () => {
	it("registers the token from the plugin", async () => {
		const api = fakeApi();
		const provider = createFcmProvider({
			port: fakePort({ "plugin:fcm|get_token": { token: "fresh" } }),
			token: memory(),
		});
		expect(await provider.subscribe(api)).toBe(true);
		expect(api.registered).toEqual([
			{ provider: "fcm", platform: "android", token: "fresh" },
		]);
	});

	it("rotates to a refreshed token", async () => {
		const api = fakeApi();
		const port = fakePort({ "plugin:fcm|get_token": { token: "second" } });
		const token = memory("first");
		const provider = createFcmProvider({ port, token });
		const changed = vi.fn();
		const stop = provider.watch(changed);
		await flush();
		port.refresh();
		expect(changed).toHaveBeenCalledTimes(1);
		await provider.subscribe(api);
		expect(api.unregistered).toEqual([{ provider: "fcm", token: "first" }]);
		expect(token.get()).toBe("second");
		stop();
		port.refresh();
		expect(changed).toHaveBeenCalledTimes(1);
	});

	it("reports no subscription without Google Play Services", async () => {
		const api = fakeApi();
		const provider = createFcmProvider({
			port: fakePort({
				"plugin:fcm|get_token": new Error("SERVICE_NOT_AVAILABLE"),
			}),
			token: memory(),
		});
		expect(await provider.subscribe(api)).toBe(false);
		expect(api.registerPush).not.toHaveBeenCalled();
	});

	it("deletes the local token even when the AppView is unreachable", async () => {
		const port = fakePort();
		const token = memory("cached");
		const provider = createFcmProvider({ port, token });
		const api = fakeApi();
		api.unregisterPush.mockRejectedValueOnce(new Error("offline"));
		await expect(provider.unsubscribe(api)).rejects.toThrow("offline");
		expect(port.calls.map((call) => call.command)).toContain(
			"plugin:fcm|delete_token",
		);
		expect(token.get()).toBeUndefined();
	});
});

const fakeWorkers = (options: { existing?: boolean } = {}) => {
	const listeners = new Set<(event: Event) => void>();
	const closed: string[] = [];
	let subscription: PushSubscription | null = null;
	const makeSubscription = (endpoint: string) =>
		({
			endpoint,
			getKey: (name: string) =>
				new Uint8Array(name === "p256dh" ? [1, 2, 3] : [4, 5]).buffer,
			unsubscribe: vi.fn(async () => {
				subscription = null;
				return true;
			}),
		}) as unknown as PushSubscription;
	if (options.existing) subscription = makeSubscription("https://push/old");
	const subscribe = vi.fn(async () => {
		subscription = makeSubscription("https://push/new");
		return subscription;
	});
	const notifications = [
		{ data: { channelUri: "c1" }, close: () => closed.push("c1") },
		{
			data: { channelUri: "c1", threadUri: "t1" },
			close: () => closed.push("t1"),
		},
		{ data: { channelUri: "c2" }, close: () => closed.push("c2") },
	];
	const registration = {
		pushManager: {
			getSubscription: async () => subscription,
			subscribe,
		},
		getNotifications: async () => notifications,
	} as unknown as ServiceWorkerRegistration;
	const workers: PushWorkers = {
		register: vi.fn(async () => registration),
		getRegistration: vi.fn(async () => registration),
		ready: Promise.resolve(registration),
		addEventListener: ((_: string, listener: (event: Event) => void) =>
			listeners.add(listener)) as PushWorkers["addEventListener"],
		removeEventListener: ((_: string, listener: (event: Event) => void) =>
			listeners.delete(listener)) as PushWorkers["removeEventListener"],
	};
	return {
		workers,
		subscribe,
		closed,
		post: (data: unknown) => {
			for (const listener of listeners) {
				listener({ data } as unknown as Event);
			}
		},
	};
};

describe("web push", () => {
	it("subscribes and sends the serialized keys", async () => {
		const fake = fakeWorkers();
		const api = fakeApi();
		const endpoint = memory();
		const provider = createWebPushProvider({
			environment: { workers: fake.workers, vapidKey: "AQID" },
			endpoint,
		});
		expect(await provider.subscribe(api)).toBe(true);
		expect(fake.workers.register).toHaveBeenCalledWith("/push-sw.js");
		expect(fake.subscribe).toHaveBeenCalledWith({
			userVisibleOnly: true,
			applicationServerKey: new Uint8Array([1, 2, 3]),
		});
		expect(api.registered).toEqual([
			{
				provider: "webpush",
				platform: "web",
				endpoint: "https://push/new",
				p256dh: "AQID",
				auth: "BAU=",
			},
		]);
		expect(endpoint.get()).toBe("https://push/new");
	});

	it("reuses an existing subscription and retires a stale endpoint", async () => {
		const fake = fakeWorkers({ existing: true });
		const api = fakeApi();
		const provider = createWebPushProvider({
			environment: { workers: fake.workers, vapidKey: "AQID" },
			endpoint: memory("https://push/older"),
		});
		await provider.subscribe(api);
		expect(fake.subscribe).not.toHaveBeenCalled();
		expect(api.unregistered).toEqual([
			{ provider: "webpush", endpoint: "https://push/older" },
		]);
	});

	it("unsubscribes locally and on the AppView", async () => {
		const fake = fakeWorkers({ existing: true });
		const api = fakeApi();
		const provider = createWebPushProvider({
			environment: { workers: fake.workers, vapidKey: "AQID" },
			endpoint: memory(),
		});
		expect(await provider.hasLeftover()).toBe(true);
		await provider.unsubscribe(api);
		expect(api.unregistered).toEqual([
			{ provider: "webpush", endpoint: "https://push/old" },
		]);
		expect(await provider.hasLeftover()).toBe(false);
	});

	it("reasserts when the service worker reports a new subscription", () => {
		const fake = fakeWorkers();
		const provider = createWebPushProvider({
			environment: { workers: fake.workers, vapidKey: "AQID" },
			endpoint: memory(),
		});
		const changed = vi.fn();
		const stop = provider.watch(changed);
		fake.post({ type: "colibri-push-subscription-changed" });
		fake.post({ type: "something-else" });
		stop();
		fake.post({ type: "colibri-push-subscription-changed" });
		expect(changed).toHaveBeenCalledTimes(1);
	});

	it("closes worker notifications for one conversation or all of them", async () => {
		const fake = fakeWorkers();
		const provider = createWebPushProvider({
			environment: { workers: fake.workers, vapidKey: "AQID" },
			endpoint: memory(),
		});
		await provider.dismiss("c1");
		expect(fake.closed).toEqual(["c1"]);
		await provider.dismiss(undefined);
		expect(fake.closed).toEqual(["c1", "c1", "t1", "c2"]);
	});
});

const fakeProvider = (overrides: Partial<PushProvider> = {}): PushProvider => ({
	kind: "apns",
	subscribe: vi.fn(async () => true),
	unsubscribe: vi.fn(async () => {}),
	hasLeftover: vi.fn(async () => false),
	watch: () => () => {},
	dismiss: vi.fn(async () => {}),
	...overrides,
});

const fakeTauri = () => {
	const calls: { command: string; args?: Record<string, unknown> }[] = [];
	const port: TauriPort = {
		invoke: async <T>(command: string, args?: Record<string, unknown>) => {
			calls.push({ command, ...(args ? { args } : {}) });
			return undefined as T;
		},
		listen: async () => () => {},
	};
	return { port, calls };
};

describe("createPush", () => {
	it("turns on when registration succeeds", async () => {
		const provider = fakeProvider();
		const push = createPush({
			source: fakeApi(),
			device: { active: () => true },
			provider,
		});
		expect(await push.enable()).toBe(true);
		expect(push.active()).toBe(true);
	});

	it("shares one registration between overlapping calls", async () => {
		const provider = fakeProvider();
		const push = createPush({
			source: fakeApi(),
			device: { active: () => true },
			provider,
		});
		await Promise.all([push.enable(), push.reassert(), push.enable()]);
		expect(vi.mocked(provider.subscribe)).toHaveBeenCalledTimes(1);
	});

	it("falls back to live notifications when the AppView refuses", async () => {
		const provider = fakeProvider({
			subscribe: vi.fn(async () => {
				throw new Error("PushNotConfigured");
			}),
		});
		const push = createPush({
			source: fakeApi(),
			device: { active: () => true },
			provider,
		});
		expect(await push.enable()).toBe(false);
		expect(push.active()).toBe(false);
	});

	it("reasserts on the device toggle and clears leftovers when off", async () => {
		let on = true;
		const provider = fakeProvider({ hasLeftover: vi.fn(async () => true) });
		const refresh = vi.fn(async () => "granted");
		const push = createPush({
			source: fakeApi(),
			device: { active: () => on, refresh },
			provider,
		});
		await push.reassert();
		expect(push.active()).toBe(true);
		on = false;
		await push.reassert();
		expect(refresh).toHaveBeenCalledTimes(2);
		expect(vi.mocked(provider.unsubscribe)).toHaveBeenCalledTimes(1);
		expect(push.active()).toBe(false);
	});

	it("tells the native shell about live delivery once per change", () => {
		const { port, calls } = fakeTauri();
		const push = createPush({
			source: fakeApi(),
			device: { active: () => true },
			provider: fakeProvider({ kind: "fcm" }),
			port,
		});
		push.setLive(true);
		push.setLive(true);
		push.setLive(false);
		void push.dismissRead([]);
		void push.dismissRead(["c1"]);
		expect(calls).toEqual([
			{ command: "push_set_live", args: { live: true } },
			{ command: "push_set_live", args: { live: false } },
			{ command: "push_dismiss_read", args: { channels: ["c1"] } },
		]);
	});

	it("leaves the native commands alone for web push", () => {
		const { port, calls } = fakeTauri();
		const push = createPush({
			source: fakeApi(),
			device: { active: () => true },
			provider: fakeProvider({ kind: "web" }),
			port,
		});
		push.setLive(true);
		void push.dismissRead(["c1"]);
		expect(calls).toEqual([]);
	});

	it("does nothing on platforms without push", async () => {
		const push = createPush({
			source: fakeApi(),
			device: { active: () => true },
			provider: null,
		});
		expect(await push.enable()).toBe(false);
		expect(push.kind).toBeUndefined();
	});
});

describe("teardownLeftoverPush", () => {
	it("removes a leftover registration locally", async () => {
		const provider = fakeProvider({ hasLeftover: vi.fn(async () => true) });
		await teardownLeftoverPush(provider);
		expect(vi.mocked(provider.unsubscribe)).toHaveBeenCalledWith();
	});

	it("skips devices that never registered", async () => {
		const provider = fakeProvider();
		await teardownLeftoverPush(provider);
		expect(vi.mocked(provider.unsubscribe)).not.toHaveBeenCalled();
	});
});

describe("readTargets", () => {
	it("lists read channels and threads whose notifications were all seen", () => {
		const general =
			"at://did:plc:hq/space/social.colibri.beta.channel.text/general";
		const busy = "at://did:plc:hq/space/social.colibri.beta.channel.text/busy";
		const done =
			"at://did:plc:hq/space/social.colibri.beta.channel.thread/done";
		const open =
			"at://did:plc:hq/space/social.colibri.beta.channel.thread/open";
		const store = {
			communities: { value: () => [{ did: "did:plc:hq" }] },
			space: () => ({
				channels: { value: () => [{ space: general }, { space: busy }] },
				unread: (slug: string) => ({
					hasUnread: slug === "busy",
					mentions: 0,
				}),
			}),
			notifications: {
				items: () => [
					{ channel: general, thread: done, seenAt: "2026-10-17T00:00:00Z" },
					{ channel: general, thread: open },
				],
			},
		} as unknown as ReadSweepStore;
		expect(readTargets(store)).toEqual([general, done]);
	});

	it("waits before sweeping and only sends when something is read", async () => {
		const dismiss = vi.fn();
		let targets: string[] = [];
		const sweep = createReadSweep({
			targets: () => targets,
			dismiss,
			delayMs: 5,
		});
		sweep.schedule();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(dismiss).not.toHaveBeenCalled();
		targets = ["c1"];
		sweep.schedule();
		sweep.schedule();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(dismiss).toHaveBeenCalledTimes(1);
		expect(dismiss).toHaveBeenCalledWith(["c1"]);
	});
});

import {
	AUTH_SUBPROTOCOL,
	type ColibriError,
	EVENTS_LXM,
} from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent } from "../../source";
import {
	createLiveConnection,
	HEARTBEAT_MS,
	type LiveConnectionOptions,
	type LiveSocket,
	PROBE_TIMEOUT_MS,
	type ServiceAuthAgent,
	socketUrl,
	UNREACHABLE_AFTER,
} from "./connection";

type Listener = (event: {
	data?: unknown;
	code?: number;
	reason?: string;
}) => void;

class FakeSocket {
	readyState = 0;
	sent: unknown[] = [];
	listeners = new Map<string, Listener[]>();

	constructor(
		readonly url: string,
		readonly protocols: string[],
	) {}

	addEventListener(type: string, listener: Listener) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	send(data: string) {
		this.sent.push(JSON.parse(data));
	}

	close() {
		if (this.readyState === 3) return;
		this.readyState = 3;
		this.emit("close", { code: 1000, reason: "" });
	}

	emit(
		type: string,
		event: { data?: unknown; code?: number; reason?: string } = {},
	) {
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}

	open() {
		this.readyState = 1;
		this.emit("open");
	}

	drop(code = 1006, reason = "") {
		this.readyState = 3;
		this.emit("close", { code, reason });
	}

	receive(frame: unknown) {
		this.emit("message", { data: JSON.stringify(frame) });
	}

	frames(name: string) {
		return this.sent.filter(
			(frame) =>
				(frame as { $type: string }).$type ===
				`social.colibri.beta.sync.defs#${name}`,
		);
	}
}

const HOST = "https://spaces-api.colibri.social";
const SERVICE = "did:web:spaces-api.colibri.social#colibri_appview";
const COMMUNITY = "did:plc:colibrihqspace2a4b6c8d";
const GENERAL = `at://${COMMUNITY}/space/social.colibri.beta.channel.text/general`;

let sockets: FakeSocket[];
type GetServiceAuth =
	ServiceAuthAgent["com"]["atproto"]["server"]["getServiceAuth"];

let getServiceAuth: ReturnType<typeof vi.fn<GetServiceAuth>>;

const latest = () => {
	const socket = sockets.at(-1);
	if (!socket) throw new Error("no socket was created");
	return socket;
};

const flush = () => vi.advanceTimersByTimeAsync(0);

const start = (overrides: Partial<LiveConnectionOptions> = {}) =>
	createLiveConnection({
		agent: { com: { atproto: { server: { getServiceAuth } } } },
		appViewHost: HOST,
		serviceRef: SERVICE,
		environment: null,
		random: () => 0.5,
		createSocket: (url, protocols) => {
			const socket = new FakeSocket(url, protocols);
			sockets.push(socket);
			return socket as unknown as LiveSocket;
		},
		...overrides,
	});

beforeEach(() => {
	vi.useFakeTimers();
	sockets = [];
	getServiceAuth = vi.fn<GetServiceAuth>(async () => ({
		data: { token: "token-1" },
	}));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("socketUrl", () => {
	it("maps https and bare hosts to wss and http to ws", () => {
		expect(socketUrl(HOST)).toBe(
			"wss://spaces-api.colibri.social/xrpc/social.colibri.beta.sync.subscribeEvents",
		);
		expect(socketUrl("spaces-api.colibri.social")).toBe(socketUrl(HOST));
		expect(socketUrl("http://127.0.0.1:3000")).toBe(
			"ws://127.0.0.1:3000/xrpc/social.colibri.beta.sync.subscribeEvents",
		);
	});
});

describe("createLiveConnection", () => {
	it("opens with a service-auth token in the subprotocol list", async () => {
		const live = start();
		expect(live.status()).toBe("connecting");
		await flush();

		expect(getServiceAuth).toHaveBeenCalledWith(
			expect.objectContaining({ aud: SERVICE, lxm: EVENTS_LXM }),
		);
		expect(latest().protocols).toEqual([AUTH_SUBPROTOCOL, "token-1"]);
		expect(latest().url).toBe(socketUrl(HOST));

		latest().open();
		expect(live.status()).toBe("open");
		live.close();
	});

	it("delivers decoded frames to every subscriber and isolates throwing ones", async () => {
		const live = start();
		await flush();
		latest().open();

		const received: LiveEvent[] = [];
		live.subscribe(() => {
			throw new Error("boom");
		});
		const stop = live.subscribe((event) => received.push(event));

		latest().receive({
			$type: "social.colibri.beta.sync.defs#typingEvent",
			did: "did:plc:alice",
			channel: GENERAL,
		});
		latest().receive({ $type: "social.colibri.beta.sync.defs#nonsense" });
		latest().emit("message", { data: "not json" });

		expect(received).toEqual([
			{
				$type: "typingEvent",
				did: "did:plc:alice",
				channel: GENERAL,
			},
		]);

		stop();
		latest().receive({
			$type: "social.colibri.beta.sync.defs#typingEvent",
			did: "did:plc:bob",
			channel: GENERAL,
		});
		expect(received).toHaveLength(1);
		live.close();
	});

	it("sends a heartbeat on every interval while open", async () => {
		const live = start();
		await flush();
		latest().open();

		for (let beat = 0; beat < 3; beat++) {
			await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
			latest().receive({ $type: "social.colibri.beta.sync.defs#ack" });
		}
		expect(latest().frames("heartbeat")).toHaveLength(3);
		expect(sockets).toHaveLength(1);
		expect(live.status()).toBe("open");
		live.close();
	});

	it("reconnects when a heartbeat goes unanswered while the app stays in view", async () => {
		const live = start();
		await flush();
		latest().open();

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		expect(latest().frames("heartbeat")).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
		expect(live.status()).toBe("reconnecting");
		expect(sockets).toHaveLength(2);
		live.close();
	});

	it("tells a new socket which channel is in view", async () => {
		const live = start();
		await flush();
		latest().open();
		live.send({
			$type: "social.colibri.beta.sync.defs#viewChannel",
			channel: GENERAL,
		} as never);

		latest().drop();
		await vi.advanceTimersByTimeAsync(1_000);
		latest().open();
		expect(latest().frames("viewChannel")).toEqual([
			{ $type: "social.colibri.beta.sync.defs#viewChannel", channel: GENERAL },
		]);

		live.send({ $type: "social.colibri.beta.sync.defs#viewChannel" } as never);
		latest().drop();
		await vi.advanceTimersByTimeAsync(2_000);
		latest().open();
		expect(latest().frames("viewChannel")).toEqual([]);
		live.close();
	});

	it("remembers the channel in view even when the socket is down", async () => {
		const live = start();
		await flush();
		expect(
			live.send({
				$type: "social.colibri.beta.sync.defs#viewChannel",
				channel: GENERAL,
			} as never),
		).toBe(false);
		latest().open();
		expect(latest().frames("viewChannel")).toEqual([
			{ $type: "social.colibri.beta.sync.defs#viewChannel", channel: GENERAL },
		]);
		live.close();
	});

	it("reconnects with exponential backoff after a drop", async () => {
		const live = start();
		await flush();
		latest().open();
		latest().drop();

		expect(live.status()).toBe("reconnecting");
		expect(sockets).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(999);
		expect(sockets).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(sockets).toHaveLength(2);

		latest().drop();
		await vi.advanceTimersByTimeAsync(1_999);
		expect(sockets).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(sockets).toHaveLength(3);

		latest().open();
		expect(live.status()).toBe("open");

		latest().drop();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(sockets).toHaveLength(4);
		live.close();
	});

	it("exposes when the next attempt is due and clears it on connect", async () => {
		const live = start();
		await flush();
		expect(live.retryAt()).toBeUndefined();
		latest().open();
		latest().drop();
		expect(live.retryAt()).toBe(Date.now() + 1_000);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(live.retryAt()).toBeUndefined();
		latest().drop();
		expect(live.retryAt()).toBe(Date.now() + 2_000);
		live.retry();
		expect(live.retryAt()).toBeUndefined();
		live.close();
	});

	it("caps the backoff at thirty seconds", async () => {
		const live = start();
		await flush();
		for (let i = 0; i < 8; i++) {
			latest().drop();
			await vi.advanceTimersByTimeAsync(30_000);
		}
		const before = sockets.length;
		latest().drop();
		await vi.advanceTimersByTimeAsync(29_999);
		expect(sockets).toHaveLength(before);
		await vi.advanceTimersByTimeAsync(1);
		expect(sockets).toHaveLength(before + 1);
		live.close();
	});

	it("reports unreachable when the first connection keeps failing, and recovers", async () => {
		const live = start();
		await flush();
		for (let i = 1; i < UNREACHABLE_AFTER; i++) {
			latest().drop();
			expect(live.status()).toBe("connecting");
			await vi.advanceTimersByTimeAsync(30_000);
		}
		latest().drop();
		expect(live.status()).toBe("unreachable");

		await vi.advanceTimersByTimeAsync(30_000);
		latest().open();
		expect(live.status()).toBe("open");
		live.close();
	});

	it("hands a rejected handshake to the auth layer", async () => {
		const failures: ColibriError[] = [];
		const live = start({ onAuthFailure: (error) => failures.push(error) });
		await flush();
		latest().drop(4401, "expired");

		expect(failures.map((error) => error.code)).toEqual(["AuthRequired"]);
		expect(failures[0]?.context).toMatchObject({ closeCode: 4401 });
		live.close();
	});

	it("hands a failed token fetch to the auth layer and retries", async () => {
		const failures: ColibriError[] = [];
		getServiceAuth.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const live = start({ onAuthFailure: (error) => failures.push(error) });
		await flush();

		expect(failures).toHaveLength(1);
		expect(sockets).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(sockets).toHaveLength(1);
		live.close();
	});

	it("stops reconnecting once the session is dead", async () => {
		let dead = false;
		const live = start({ isSessionDead: () => dead });
		await flush();
		latest().open();
		dead = true;
		latest().drop(4401);

		await vi.advanceTimersByTimeAsync(60_000);
		expect(sockets).toHaveLength(1);
		live.close();
	});

	it("declares watched targets on open, replays them after a reconnect and withdraws them", async () => {
		const live = start();
		const release = live.watch({ communities: [COMMUNITY] });
		await flush();
		latest().open();
		expect(latest().frames("subscribe")).toEqual([
			{
				$type: "social.colibri.beta.sync.defs#subscribe",
				communities: [COMMUNITY],
				channels: [],
			},
		]);

		latest().receive({
			$type: "social.colibri.beta.sync.defs#subscribed",
			communities: [],
			channels: [],
		});
		expect([...live.denied().communities]).toEqual([COMMUNITY]);

		latest().drop();
		await vi.advanceTimersByTimeAsync(1_000);
		latest().open();
		expect(latest().frames("subscribe")).toHaveLength(1);

		release();
		await flush();
		expect(latest().frames("unsubscribe")).toEqual([
			{
				$type: "social.colibri.beta.sync.defs#unsubscribe",
				communities: [COMMUNITY],
				channels: [],
			},
		]);
		live.close();
	});

	it("probes on wake and reconnects when the probe goes unanswered", async () => {
		let wake = () => {};
		const live = start({
			environment: {
				onWake: (next) => {
					wake = next;
					return () => {};
				},
			},
		});
		await flush();
		latest().open();
		vi.advanceTimersByTime(31_000);

		wake();
		expect(latest().frames("heartbeat").length).toBeGreaterThan(0);
		await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
		expect(live.status()).toBe("reconnecting");
		expect(sockets).toHaveLength(2);
		live.close();
	});

	it("keeps the socket when the probe is answered", async () => {
		let wake = () => {};
		const live = start({
			environment: {
				onWake: (next) => {
					wake = next;
					return () => {};
				},
			},
		});
		await flush();
		latest().open();

		wake();
		latest().receive({ $type: "social.colibri.beta.sync.defs#ack" });
		await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
		expect(live.status()).toBe("open");
		expect(sockets).toHaveLength(1);
		live.close();
	});

	it("retries immediately on demand", async () => {
		const live = start();
		await flush();
		latest().drop();
		live.retry();
		await flush();
		expect(sockets).toHaveLength(2);
		live.close();
	});

	it("starts a new continuity epoch on every subscription and has none while down", async () => {
		const live = start();
		expect(live.epoch()).toBeUndefined();
		await flush();
		latest().open();
		const first = live.epoch();
		expect(first).toBeDefined();
		latest().drop();
		expect(live.epoch()).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1_000);
		latest().open();
		expect(live.epoch()).toBeDefined();
		expect(live.epoch()).not.toBe(first);
		live.close();
		expect(live.epoch()).toBeUndefined();
	});

	it("goes quiet after close", async () => {
		const live = start();
		await flush();
		latest().open();
		live.close();

		await vi.advanceTimersByTimeAsync(120_000);
		expect(sockets).toHaveLength(1);
		expect(latest().frames("heartbeat")).toHaveLength(0);
	});
});

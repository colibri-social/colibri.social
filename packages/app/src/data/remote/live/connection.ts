import {
	AUTH_SUBPROTOCOL,
	type ClientFrame,
	ColibriError,
	classifyThrown,
	createLogger,
	decodeFrame,
	EVENTS_LXM,
	EVENTS_PATH,
	encodeFrame,
	frameIs,
	heartbeatFrame,
	subscribeFrame,
	subscriptionTargets,
	unsubscribeFrame,
} from "@colibri-social/lib";
import { type Accessor, createSignal } from "solid-js";
import type { BlobLocator } from "../../emoji";
import type { LiveEvent } from "../../source";
import { toLiveEvents } from "./frames";
import {
	createSubscriptionLedger,
	isEmptyDelta,
	mergeDelta,
	type SubscriptionDelta,
	type SubscriptionSets,
	type SubscriptionTarget,
} from "./ledger";

const log = createLogger("live");

export type LiveStatus = "connecting" | "open" | "reconnecting" | "unreachable";

export type ServiceAuthAgent = {
	com: {
		atproto: {
			server: {
				getServiceAuth(params: {
					aud: string;
					lxm?: string;
					exp?: number;
				}): Promise<{ data: { token: string } }>;
			};
		};
	};
};

export type LiveSocket = Pick<
	WebSocket,
	"readyState" | "send" | "close" | "addEventListener"
>;

export type LiveEnvironment = {
	onWake: (wake: () => void) => () => void;
};

export type LiveConnectionOptions = {
	agent: ServiceAuthAgent;
	appViewHost: string;
	serviceRef: string;
	emojiBlobUrl?: BlobLocator;
	onAuthFailure?: (error: ColibriError) => void;
	isSessionDead?: () => boolean;
	createSocket?: (url: string, protocols: string[]) => LiveSocket;
	environment?: LiveEnvironment | null;
	random?: () => number;
};

export type LiveConnection = {
	subscribe: (listener: (event: LiveEvent) => void) => () => void;
	status: Accessor<LiveStatus>;
	epoch: Accessor<number | undefined>;
	retryAt: Accessor<number | undefined>;
	close: () => void;
	retry: () => void;
	watch: (target: SubscriptionTarget) => () => void;
	send: (frame: ClientFrame) => boolean;
	granted: Accessor<SubscriptionSets>;
	denied: Accessor<SubscriptionSets>;
};

export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
export const HEARTBEAT_MS = 20_000;
export const STALE_MS = 30_000;
export const PROBE_TIMEOUT_MS = 5_000;
export const UNREACHABLE_AFTER = 4;
export const TOKEN_TTL_S = 60;

const OPEN = 1;

const isRejection = (code: number): boolean =>
	code === 1008 || (code >= 4400 && code <= 4499);

export const socketUrl = (host: string): string => {
	const url = new URL(/^[a-z]+:\/\//i.test(host) ? host : `https://${host}`);
	url.protocol =
		url.protocol === "http:" || url.protocol === "ws:" ? "ws:" : "wss:";
	url.pathname = EVENTS_PATH;
	url.search = "";
	url.hash = "";
	return url.toString();
};

const browserEnvironment = (): LiveEnvironment | null => {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return null;
	}
	return {
		onWake: (wake) => {
			const onVisible = () => {
				if (document.visibilityState === "visible") wake();
			};
			document.addEventListener("visibilitychange", onVisible);
			window.addEventListener("online", wake);
			window.addEventListener("focus", wake);
			return () => {
				document.removeEventListener("visibilitychange", onVisible);
				window.removeEventListener("online", wake);
				window.removeEventListener("focus", wake);
			};
		},
	};
};

const NOTHING: SubscriptionSets = {
	communities: new Set(),
	channels: new Set(),
};

export const createLiveConnection = (
	options: LiveConnectionOptions,
): LiveConnection => {
	const createSocket =
		options.createSocket ??
		((url: string, protocols: string[]) => new WebSocket(url, protocols));
	const random = options.random ?? Math.random;
	const sessionDead = () => options.isSessionDead?.() ?? false;
	const url = socketUrl(options.appViewHost);

	const listeners = new Set<(event: LiveEvent) => void>();
	const [status, setStatus] = createSignal<LiveStatus>("connecting");
	const [retryAt, setRetryAt] = createSignal<number | undefined>();
	const [granted, setGranted] = createSignal<SubscriptionSets>(NOTHING);
	const [confirmed, setConfirmed] = createSignal(false);
	const [epoch, setEpoch] = createSignal<number>();
	let subscriptions = 0;
	const ledger = createSubscriptionLedger();

	let ws: LiveSocket | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let probeTimer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;
	let hadConnectedOnce = false;
	let attempt = 0;
	let failures = 0;
	let lastFrameAt = Date.now();
	let generation = 0;
	let connectStartedAt: number | null = null;

	const backoffMs = (n: number): number => {
		const capped = Math.min(RECONNECT_BASE_MS * 2 ** n, RECONNECT_MAX_MS);
		return capped * (0.8 + random() * 0.4);
	};

	const settleFailure = () => {
		failures++;
		if (hadConnectedOnce) {
			setStatus("reconnecting");
			return;
		}
		setStatus(failures >= UNREACHABLE_AFTER ? "unreachable" : "connecting");
	};

	const scheduleReconnect = () => {
		if (closed || sessionDead()) return;
		const delay = backoffMs(attempt++);
		setRetryAt(Date.now() + delay);
		reconnectTimer = setTimeout(connect, delay);
	};

	const sendFrame = (frame: ClientFrame): boolean => {
		if (ws?.readyState !== OPEN) return false;
		ws.send(encodeFrame(frame));
		return true;
	};

	let pendingAdds: SubscriptionDelta | null = null;
	let pendingRemovals: SubscriptionDelta | null = null;
	let flushQueued = false;

	const flushSubscriptions = () => {
		flushQueued = false;
		const removals = pendingRemovals;
		pendingRemovals = null;
		if (removals && !isEmptyDelta(removals)) {
			sendFrame(
				unsubscribeFrame(
					subscriptionTargets(removals.communities, removals.channels),
				),
			);
		}
		const adds = pendingAdds;
		pendingAdds = null;
		if (adds && !isEmptyDelta(adds)) {
			sendFrame(
				subscribeFrame(subscriptionTargets(adds.communities, adds.channels)),
			);
		}
	};

	const queueFlush = () => {
		if (flushQueued) return;
		flushQueued = true;
		queueMicrotask(flushSubscriptions);
	};

	const resubscribeAll = () => {
		pendingAdds = null;
		pendingRemovals = null;
		flushQueued = false;
		setConfirmed(false);
		setGranted(NOTHING);
		subscriptions += 1;
		setEpoch(subscriptions);
		const wanted = ledger.wanted();
		if (wanted.communities.size === 0 && wanted.channels.size === 0) return;
		sendFrame(
			subscribeFrame(subscriptionTargets(wanted.communities, wanted.channels)),
		);
	};

	const dispatch = (event: LiveEvent) => {
		for (const listener of listeners) {
			try {
				listener(event);
			} catch (err) {
				log.error("a live listener threw", {
					type: event.$type,
					code: classifyThrown(err).code,
				});
			}
		}
	};

	const stopHeartbeat = () => {
		if (!heartbeat) return;
		clearInterval(heartbeat);
		heartbeat = null;
	};

	const clearProbe = () => {
		if (!probeTimer) return;
		clearTimeout(probeTimer);
		probeTimer = null;
	};

	const clearReconnect = () => {
		setRetryAt(undefined);
		if (!reconnectTimer) return;
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	};

	const reportAuthFailure = (error: ColibriError) => {
		options.onAuthFailure?.(error);
	};

	async function connect(): Promise<void> {
		if (closed || sessionDead()) return;
		clearReconnect();

		const myGeneration = ++generation;
		connectStartedAt = Date.now();

		let token: string;
		try {
			const { data } = await options.agent.com.atproto.server.getServiceAuth({
				aud: options.serviceRef,
				lxm: EVENTS_LXM,
				exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S,
			});
			token = data.token;
		} catch (err) {
			const failure = classifyThrown(err, {
				method: "com.atproto.server.getServiceAuth",
			});
			log.error("live token fetch failed", { code: failure.code });
			if (closed || myGeneration !== generation) return;
			reportAuthFailure(failure);
			connectStartedAt = null;
			settleFailure();
			scheduleReconnect();
			return;
		}

		if (closed || myGeneration !== generation) return;

		let socket: LiveSocket;
		try {
			socket = createSocket(url, [AUTH_SUBPROTOCOL, token]);
		} catch (err) {
			log.error("live socket could not be created", {
				code: classifyThrown(err).code,
			});
			connectStartedAt = null;
			settleFailure();
			scheduleReconnect();
			return;
		}
		ws = socket;

		socket.addEventListener("open", () => {
			if (closed || ws !== socket) return;
			connectStartedAt = null;
			hadConnectedOnce = true;
			attempt = 0;
			failures = 0;
			lastFrameAt = Date.now();
			setStatus("open");
			stopHeartbeat();
			heartbeat = setInterval(() => {
				if (closed || ws !== socket) return;
				if (socket.readyState !== OPEN) {
					forceReconnect();
					return;
				}
				socket.send(encodeFrame(heartbeatFrame()));
			}, HEARTBEAT_MS);
			resubscribeAll();
		});

		socket.addEventListener("message", (message) => {
			if (closed || ws !== socket) {
				socket.close();
				return;
			}
			lastFrameAt = Date.now();
			const raw = String(message.data);
			const frame = decodeFrame(raw);
			if (!frame) return;

			if (frameIs(frame, "subscribed")) {
				setGranted({
					communities: new Set(frame.communities),
					channels: new Set(frame.channels),
				});
				setConfirmed(true);
				return;
			}

			if (frameIs(frame, "error")) {
				log.warn("the live socket reported an error", { error: frame.error });
				return;
			}

			for (const event of toLiveEvents(frame, {
				emojiBlobUrl: options.emojiBlobUrl,
			}))
				dispatch(event);
		});

		socket.addEventListener("close", (event) => {
			clearProbe();
			if (ws !== socket) return;
			stopHeartbeat();
			ws = null;
			setEpoch(undefined);
			if (closed) return;
			connectStartedAt = null;
			log.warn("live socket closed", { code: event.code });

			if (isRejection(event.code)) {
				reportAuthFailure(
					new ColibriError({
						code: "AuthRequired",
						message: `the event socket rejected the handshake (${event.code})`,
						context: { closeCode: event.code, closeReason: event.reason },
					}),
				);
			}

			settleFailure();
			scheduleReconnect();
		});

		socket.addEventListener("error", () => {
			log.error("live socket errored");
		});
	}

	function forceReconnect(): void {
		if (closed || sessionDead()) return;
		if (connectStartedAt !== null && Date.now() - connectStartedAt < STALE_MS) {
			return;
		}
		clearProbe();
		clearReconnect();
		stopHeartbeat();
		attempt = 0;
		const stale = ws;
		ws = null;
		setEpoch(undefined);
		stale?.close();
		if (hadConnectedOnce) setStatus("reconnecting");
		void connect();
	}

	const probeLiveness = () => {
		if (closed || sessionDead()) return;
		if (ws?.readyState !== OPEN) {
			forceReconnect();
			return;
		}
		if (probeTimer) return;
		const probedAt = Date.now();
		if (!sendFrame(heartbeatFrame())) {
			forceReconnect();
			return;
		}
		probeTimer = setTimeout(() => {
			probeTimer = null;
			if (closed || ws?.readyState !== OPEN) return;
			if (lastFrameAt >= probedAt) return;
			log.warn("no reply to the liveness probe, reconnecting");
			forceReconnect();
		}, PROBE_TIMEOUT_MS);
	};

	const environment =
		options.environment === undefined
			? browserEnvironment()
			: options.environment;
	const unwatchEnvironment = environment?.onWake(probeLiveness);

	void connect();

	return {
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		status,
		epoch,
		retryAt,
		close: () => {
			if (closed) return;
			closed = true;
			setEpoch(undefined);
			unwatchEnvironment?.();
			clearProbe();
			clearReconnect();
			stopHeartbeat();
			const socket = ws;
			ws = null;
			socket?.close();
			listeners.clear();
		},
		retry: () => {
			if (closed || sessionDead()) return;
			connectStartedAt = null;
			forceReconnect();
		},
		watch: (target) => {
			const added = ledger.retain(target);
			if (!isEmptyDelta(added)) {
				pendingAdds = mergeDelta(pendingAdds, added);
				queueFlush();
			}
			let released = false;
			return () => {
				if (released) return;
				released = true;
				const dropped = ledger.release(target);
				if (!isEmptyDelta(dropped)) {
					pendingRemovals = mergeDelta(pendingRemovals, dropped);
					queueFlush();
				}
			};
		},
		send: sendFrame,
		granted,
		denied: () => (confirmed() ? ledger.missing(granted()) : NOTHING),
	};
};

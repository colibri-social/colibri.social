import {
	type Accessor,
	createContext,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { noteAuthFailure, sessionDead } from "../atproto/session-health";
import {
	createSubscriptionLedger,
	isEmptyDelta,
	mergeDelta,
	type SubscriptionDelta,
	type SubscriptionSets,
	type SubscriptionTarget,
} from "../atproto/subscriptions";
import {
	AUTH_SUBPROTOCOL,
	type ClientFrame,
	decodeFrame,
	EVENTS_LXM,
	EVENTS_PATH,
	encodeFrame,
	frameIs,
	heartbeatFrame,
	type ServerFrame,
	subscribeFrame,
	subscriptionTargets,
	unsubscribeFrame,
} from "../atproto/sync-frames";
import { classifyThrown } from "../errors/classify";
import { ColibriError } from "../errors/error";
import { reportError } from "../errors/report";
import { getAppViewHost, getAppViewServiceRef } from "../utils/appview";
import { createLogger } from "../utils/logger";
import { useAuthContext } from "./Auth";

const log = createLogger("socket");

export type SocketStatus = "connecting" | "connected" | "reconnecting";

const isRejection = (code: number): boolean =>
	code === 1008 || (code >= 4400 && code <= 4499);

export type SocketContextValue = {
	/** Send a JSON message to the AppView over the WebSocket. */
	send: (frame: ClientFrame) => void;
	/**
	 * Register a handler for all incoming AppView events. The returned
	 * function removes the handler — call it in `onCleanup`.
	 */
	onEvent: (handler: (event: ServerFrame) => void) => () => void;
	status: Accessor<SocketStatus>;
	lastCloseCode: Accessor<number | undefined>;
	/**
	 * Whether the WebSocket is currently open. `send` silently drops messages
	 * while this is `false` (no queueing), so consumers that need the server
	 * to durably know some piece of state (e.g. "view" — which channel the
	 * user is looking at) should re-send whenever this flips back to `true`,
	 * not just when their own input changes — otherwise a message sent while
	 * still connecting, or before a reconnect completes, is lost for the rest
	 * of the session.
	 */
	connected: Accessor<boolean>;
	/**
	 * Declares interest in a set of communities and channels. Nothing arrives on
	 * the socket that was not asked for, and the declaration is replayed on every
	 * reconnect, so a caller subscribes once and forgets. The returned function
	 * withdraws this caller's interest; a target stays subscribed while any other
	 * caller still wants it.
	 */
	subscribe: (target: SubscriptionTarget) => () => void;
	/** What the server confirmed this connection is receiving. */
	granted: Accessor<SubscriptionSets>;
	/**
	 * What was asked for and not granted, which is an access denial rather than an
	 * error: the server silently omits anything the user may not read.
	 */
	denied: Accessor<SubscriptionSets>;
};

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const HEARTBEAT_MS = 20_000;
const STALE_MS = 30_000;

const backoffMs = (attempt: number): number => {
	const capped = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
	return capped * (0.8 + Math.random() * 0.4);
};

export const SocketContext = createContext<SocketContextValue>();

export const SocketContextProvider: ParentComponent = (props) => {
	const auth = useAuthContext();

	const handlers = new Set<(event: ServerFrame) => void>();
	const [status, setStatus] = createSignal<SocketStatus>("connecting");
	const [lastCloseCode, setLastCloseCode] = createSignal<number | undefined>(
		undefined,
	);
	const connected = () => status() === "connected";
	let ws: WebSocket | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;
	let hadConnectedOnce = false;
	let attempt = 0;
	let lastFrameAt = Date.now();
	let generation = 0;
	let connectStartedAt: number | null = null;

	const ledger = createSubscriptionLedger();
	const [granted, setGranted] = createSignal<SubscriptionSets>({
		communities: new Set(),
		channels: new Set(),
	});
	const [confirmed, setConfirmed] = createSignal(false);

	const NOTHING: SubscriptionSets = {
		communities: new Set(),
		channels: new Set(),
	};

	const denied = (): SubscriptionSets =>
		confirmed() ? ledger.missing(granted()) : NOTHING;

	const sendFrame = (frame: ClientFrame): boolean => {
		if (ws?.readyState !== WebSocket.OPEN) return false;
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

		const wanted = ledger.wanted();
		if (wanted.communities.size === 0 && wanted.channels.size === 0) return;

		sendFrame(
			subscribeFrame(subscriptionTargets(wanted.communities, wanted.channels)),
		);
	};

	const subscribe = (target: SubscriptionTarget): (() => void) => {
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
	};

	const connect = async () => {
		if (destroyed || !auth?.loggedIn || sessionDead()) return;

		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}

		const myGeneration = ++generation;
		connectStartedAt = Date.now();

		try {
			const { data } = await auth.agent.com.atproto.server.getServiceAuth({
				aud: getAppViewServiceRef(),
				lxm: EVENTS_LXM,
				// 60-second token — we generate a fresh one on every (re)connect
				exp: Math.floor(Date.now() / 1000) + 60,
			});

			if (destroyed || myGeneration !== generation) return;

			// Browsers can't set an `Authorization` header on a WebSocket, so the
			// service-auth token is smuggled through the subprotocol list: the
			// AppView reads the entry after the `colibri.auth.bearer` sentinel and
			// echoes the sentinel back so the handshake succeeds.
			const socket = new WebSocket(`${getAppViewHost("ws")}${EVENTS_PATH}`, [
				AUTH_SUBPROTOCOL,
				data.token,
			]);
			ws = socket;

			let socketHeartbeat: ReturnType<typeof setInterval> | null = null;

			socket.addEventListener("open", () => {
				if (destroyed || ws !== socket) return;
				connectStartedAt = null;
				setStatus("connected");
				hadConnectedOnce = true;
				attempt = 0;
				lastFrameAt = Date.now();
				socketHeartbeat = setInterval(() => {
					if (destroyed || ws !== socket) return;
					if (socket.readyState !== WebSocket.OPEN) {
						forceReconnect();
						return;
					}
					socket.send(encodeFrame(heartbeatFrame()));
				}, HEARTBEAT_MS);
				heartbeat = socketHeartbeat;
				resubscribeAll();
			});

			socket.addEventListener("message", (e) => {
				if (destroyed || ws !== socket) {
					socket.close();
					return;
				}

				lastFrameAt = Date.now();
				const event = decodeFrame(e.data as string);
				if (!event) return;

				log.debug("event received", { type: event.$type });

				if (frameIs(event, "subscribed")) {
					setGranted({
						communities: new Set(event.communities),
						channels: new Set(event.channels),
					});
					setConfirmed(true);
				}

				handlers.forEach((h) => {
					// Isolate each handler so one throwing doesn't starve the rest.
					try {
						h(event);
					} catch (err) {
						log.error("a socket handler threw", {
							type: event.$type,
							code: classifyThrown(err).code,
						});
					}
				});
			});

			socket.addEventListener("close", (ev) => {
				if (socketHeartbeat) {
					clearInterval(socketHeartbeat);
					if (heartbeat === socketHeartbeat) heartbeat = null;
					socketHeartbeat = null;
				}
				if (destroyed || ws !== socket) return;
				connectStartedAt = null;
				setStatus(hadConnectedOnce ? "reconnecting" : "connecting");
				setLastCloseCode(ev.code);
				log.warn("socket closed", { code: ev.code, reason: ev.reason });

				if (isRejection(ev.code)) {
					reportError(
						new ColibriError({
							code: "AuthRequired",
							message: `the event socket rejected the handshake (${ev.code})`,
							context: { closeCode: ev.code, closeReason: ev.reason },
						}),
						{ stage: "socket" },
					);
					noteAuthFailure("AuthRequired", { closeCode: ev.code });
				}

				if (sessionDead()) return;

				reconnectTimer = setTimeout(connect, backoffMs(attempt++));
			});

			socket.addEventListener("error", () => {
				log.error("socket errored");
				// The close event will fire next and trigger reconnection
			});
		} catch (err) {
			const failure = classifyThrown(err, {
				method: "com.atproto.server.getServiceAuth",
			});
			log.error("socket token fetch failed", { code: failure.code });
			noteAuthFailure(failure.code);
			if (destroyed || myGeneration !== generation) return;
			connectStartedAt = null;
			if (!sessionDead()) {
				setStatus(hadConnectedOnce ? "reconnecting" : "connecting");
				reconnectTimer = setTimeout(connect, backoffMs(attempt++));
			}
		}
	};

	const forceReconnect = () => {
		if (destroyed || !auth?.loggedIn || sessionDead()) return;
		if (connectStartedAt !== null && Date.now() - connectStartedAt < STALE_MS)
			return;
		const healthy =
			ws?.readyState === WebSocket.OPEN && Date.now() - lastFrameAt < STALE_MS;
		if (healthy) return;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		attempt = 0;
		const stale = ws;
		ws = null;
		stale?.close();
		if (hadConnectedOnce) setStatus("reconnecting");
		connect();
	};

	const onVisible = () => {
		if (document.visibilityState === "visible") forceReconnect();
	};

	onMount(() => {
		connect();
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("online", forceReconnect);
		window.addEventListener("focus", forceReconnect);
	});

	onCleanup(() => {
		destroyed = true;
		document.removeEventListener("visibilitychange", onVisible);
		window.removeEventListener("online", forceReconnect);
		window.removeEventListener("focus", forceReconnect);
		if (heartbeat) clearInterval(heartbeat);
		if (reconnectTimer) clearTimeout(reconnectTimer);
		ws?.close();
		handlers.clear();
	});

	const value: SocketContextValue = {
		lastCloseCode,
		send: (frame) => {
			sendFrame(frame);
		},
		onEvent: (handler) => {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		status,
		connected,
		subscribe,
		granted,
		denied,
	};

	return (
		<SocketContext.Provider value={value}>
			{props.children}
		</SocketContext.Provider>
	);
};

export const useSocketContext = (): SocketContextValue => {
	const ctx = useContext(SocketContext);
	if (!ctx)
		throw new Error("useSocketContext called outside SocketContextProvider");
	return ctx;
};

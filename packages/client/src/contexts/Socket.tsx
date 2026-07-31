import type { ColibriEvent } from "@colibri-social/lib";
import {
	type Accessor,
	createContext,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
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
	send: (message: Record<string, unknown>) => void;
	/**
	 * Register a handler for all incoming AppView events. The returned
	 * function removes the handler — call it in `onCleanup`.
	 */
	onEvent: (handler: (event: ColibriEvent) => void) => () => void;
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

	const handlers = new Set<(event: ColibriEvent) => void>();
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

	const connect = async () => {
		if (destroyed || !auth?.loggedIn) return;

		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}

		try {
			const { data } = await auth.agent.com.atproto.server.getServiceAuth({
				aud: getAppViewServiceRef(),
				lxm: "social.colibri.sync.subscribeEvents",
				// 60-second token — we generate a fresh one on every (re)connect
				exp: Math.floor(Date.now() / 1000) + 60,
			});

			if (destroyed) return; // cleaned up while awaiting token

			// Browsers can't set an `Authorization` header on a WebSocket, so the
			// service-auth token is smuggled through the subprotocol list: the
			// AppView reads the entry after the `colibri.auth.bearer` sentinel and
			// echoes the sentinel back so the handshake succeeds.
			const socket = new WebSocket(
				`${getAppViewHost("ws")}/xrpc/social.colibri.sync.subscribeEvents`,
				["colibri.auth.bearer", data.token],
			);
			ws = socket;

			socket.addEventListener("open", () => {
				if (destroyed || ws !== socket) return;
				setStatus("connected");
				hadConnectedOnce = true;
				attempt = 0;
				lastFrameAt = Date.now();
				heartbeat = setInterval(() => {
					if (destroyed || ws !== socket) return;
					if (socket.readyState !== WebSocket.OPEN) {
						forceReconnect();
						return;
					}
					socket.send(JSON.stringify({ type: "heartbeat" }));
				}, HEARTBEAT_MS);
			});

			socket.addEventListener("message", (e) => {
				lastFrameAt = Date.now();
				let event: ColibriEvent;
				try {
					event = JSON.parse(e.data as string) as ColibriEvent;
				} catch {
					// Ignore malformed frames
					return;
				}

				log.debug("event received", { type: event.type });

				handlers.forEach((h) => {
					// Isolate each handler so one throwing doesn't starve the rest.
					try {
						h(event);
					} catch (err) {
						log.error("a socket handler threw", {
							type: event.type,
							error: err,
						});
					}
				});
			});

			socket.addEventListener("close", (ev) => {
				if (heartbeat) {
					clearInterval(heartbeat);
					heartbeat = null;
				}
				if (destroyed || ws !== socket) return;
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
				}

				reconnectTimer = setTimeout(connect, backoffMs(attempt++));
			});

			socket.addEventListener("error", () => {
				log.error("socket errored");
				// The close event will fire next and trigger reconnection
			});
		} catch (err) {
			log.error("socket token fetch failed", { error: err });
			if (!destroyed) {
				setStatus(hadConnectedOnce ? "reconnecting" : "connecting");
				reconnectTimer = setTimeout(connect, backoffMs(attempt++));
			}
		}
	};

	const forceReconnect = () => {
		if (destroyed || !auth?.loggedIn) return;
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
		send: (message) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(message));
			}
		},
		onEvent: (handler) => {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
		status,
		connected,
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

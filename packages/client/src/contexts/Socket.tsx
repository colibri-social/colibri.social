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
import { getAppViewHost, getAppViewServiceRef } from "../utils/appview";
import { useAuthContext } from "./Auth";

export type SocketContextValue = {
	/** Send a JSON message to the AppView over the WebSocket. */
	send: (message: Record<string, unknown>) => void;
	/**
	 * Register a handler for all incoming AppView events. The returned
	 * function removes the handler — call it in `onCleanup`.
	 */
	onEvent: (handler: (event: ColibriEvent) => void) => () => void;
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

export const SocketContext = createContext<SocketContextValue>();

export const SocketContextProvider: ParentComponent = (props) => {
	const auth = useAuthContext();

	const handlers = new Set<(event: ColibriEvent) => void>();
	const [connected, setConnected] = createSignal(false);
	let ws: WebSocket | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;

	const connect = async () => {
		if (destroyed || !auth?.loggedIn) return;

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
				setConnected(true);
				heartbeat = setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) {
						socket.send(JSON.stringify({ type: "heartbeat" }));
					}
				}, 20_000);
			});

			socket.addEventListener("message", (e) => {
				let event: ColibriEvent;
				try {
					event = JSON.parse(e.data as string) as ColibriEvent;
				} catch {
					// Ignore malformed frames
					return;
				}

				console.info("[socket] Event received:", event);

				handlers.forEach((h) => {
					// Isolate each handler so one throwing doesn't starve the rest.
					try {
						h(event);
					} catch (err) {
						console.error("[notif] socket handler threw for", event.type, err);
					}
				});
			});

			socket.addEventListener("close", (ev) => {
				if (heartbeat) {
					clearInterval(heartbeat);
					heartbeat = null;
				}
				if (destroyed || ws !== socket) return;
				setConnected(false);
				console.warn("[notif] socket CLOSED", ev.code, ev.reason);
				// Reconnect after 3 s, generating a fresh token each time
				reconnectTimer = setTimeout(connect, 3_000);
			});

			socket.addEventListener("error", () => {
				console.error("[notif] socket ERROR");
				// The close event will fire next and trigger reconnection
			});
		} catch (err) {
			console.error("[notif] socket token fetch failed", err);
			// Token fetch failed — retry after a longer delay
			if (!destroyed) reconnectTimer = setTimeout(connect, 10_000);
		}
	};

	onMount(() => {
		connect();
	});

	onCleanup(() => {
		destroyed = true;
		if (heartbeat) clearInterval(heartbeat);
		if (reconnectTimer) clearTimeout(reconnectTimer);
		ws?.close();
		handlers.clear();
	});

	const value: SocketContextValue = {
		send: (message) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(message));
			}
		},
		onEvent: (handler) => {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},
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

import {
	createContext,
	createResource,
	Match,
	ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { Client, getClient } from "../atproto/auth";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { useUserContext } from "./User";
import {
	createReconnectingWS,
	makeHeartbeatWS,
} from "@solid-primitives/websocket";
import { useAuthContext } from "./Auth";

export const SocketContext = createContext<any>();

export const SocketContextProvider: ParentComponent = (props) => {
	const auth = useAuthContext();

	const [socket] = createResource(async () => {
		if (!auth?.loggedIn) return;

		const { data } = await auth.agent.com.atproto.server.getServiceAuth({
			aud: "did:web:api.colibri.social",
			lxm: "social.colibri.sync.subscribeEvents",
			exp: Math.floor(Date.now() / 1000) + 60,
		});

		const hostWithProtocol = import.meta.env.DEV
			? `ws://127.0.0.1:8000`
			: `wss://api.colibri.social`;

		const socket = makeHeartbeatWS(
			createReconnectingWS(
				`${hostWithProtocol}/xrpc/social.colibri.sync.subscribeEvents?auth=${data.token}`,
			),
			{
				message: JSON.stringify({
					type: "heartbeat",
				}),
				interval: 20_000,
			},
		);

		await new Promise((res) => {
			socket.addEventListener("open", res);
		});

		return socket;
	});

	return (
		<Switch>
			<Match when={socket.error}>
				<span>{`${socket.error}`}</span>
			</Match>
			<Match when={socket.loading}>
				<AppLoadingScreen message="Connecting to AppView..." />
			</Match>
			<Match when={socket()}>
				{(resolved) => (
					<SocketContext.Provider value={resolved()}>
						{props.children}
					</SocketContext.Provider>
				)}
			</Match>
		</Switch>
	);
};

export const useSocketContext = (): Client => {
	const ctx = useContext(SocketContext);

	if (!ctx) {
		throw new Error("Unable to get socket context.");
	}

	return ctx;
};

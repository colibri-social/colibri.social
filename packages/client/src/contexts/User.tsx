import {
	createContext,
	createEffect,
	createResource,
	Match,
	ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { getClient } from "../atproto/auth";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import type { Agent } from "@atproto/api";
import { Community, ActorData } from "lib";
import { XrpcClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { useAuthContext } from "./Auth";

type User =
	| { loggedIn: false; atproto: { client: BrowserOAuthClient } }
	| (ActorData & {
			loggedIn: true;
			atproto: {
				client: BrowserOAuthClient;
				agent: Agent;
				pdsHost: string;
			};
			communities: Array<Community>;
	  });

export const UserContext = createContext<User>();

export const UserContextProvider: ParentComponent = (props) => {
	const client = useAuthContext();

	const [user] = createResource(async (): Promise<User> => {
		if (!client) {
			throw new Error("Unable to get client.");
		}

		if (!client.loggedIn) {
			return {
				loggedIn: false,
				atproto: {
					client: client.client,
				},
			};
		}

		const xrpc = new XrpcClient(
			client.pdsHost,
			"did:web:api.colibri.social#colibri_appview",
			client.agent,
		);

		const [actorData, communities] = await Promise.all([
			xrpc.social.colibri.actor.getData(client.agent.did!),
			xrpc.social.colibri.actor.listCommunities(),
		]);

		if (!actorData) {
			throw new Error("Unable to get actor data!");
		}

		if (!communities) {
			throw new Error("Unable to get actor communities!");
		}

		return {
			loggedIn: true,
			...actorData,
			atproto: {
				agent: client.agent,
				client: client.client,
				pdsHost: client.pdsHost,
			},
			communities: communities.communities,
		};
	});

	createEffect(() => {
		if (user.loading === true) return;

		const loggedIn = user()?.loggedIn;
		const pathname = () => window.location.pathname;

		if (!loggedIn && pathname() !== "/login") {
			window.location.href = "/login";
		}
	});

	return (
		<Switch>
			<Match when={user.error}>
				<span>{`${user.error}`}</span>
			</Match>
			<Match when={user.loading}>
				<AppLoadingScreen />
			</Match>
			<Match when={user()}>
				{(resolved) => (
					<UserContext.Provider value={resolved()}>
						{props.children}
					</UserContext.Provider>
				)}
			</Match>
		</Switch>
	);
};

export const useUserContext = (): User => {
	const ctx = useContext(UserContext);

	console.log("Context", ctx);

	if (!ctx) {
		throw new Error("Unable to get user context.");
	}

	return ctx;
};

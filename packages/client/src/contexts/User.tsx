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

export type User = ActorData & {
	atproto: {
		client: BrowserOAuthClient;
		agent: Agent;
		pdsHost: string;
	};
	communities: Array<Community>;
};

export const UserContext = createContext<User>();

export const UserContextProvider: ParentComponent = (props) => {
	const [user] = createResource(async (): Promise<User> => {
		const client = await getClient();

		if (!client?.loggedIn) {
			// FIXME: Login screen in-app on different page
			// window.location.href = "/login";
			throw new Error("Not logged in!");
		}

		const xrpc = new XrpcClient(
			client.pdsHost,
			"did:web:api.colibri.social#colibri_appview",
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
		console.log(user());
	});

	return (
		<Switch>
			<Match when={user.error}>
				<span>{`${user.error}`}</span>
			</Match>
			<Match when={user.loading}>
				<AppLoadingScreen />
			</Match>
			<Match when={!user.loading}>
				<UserContext.Provider value={user()}>
					{props.children}
				</UserContext.Provider>
			</Match>
		</Switch>
	);
};

export const useUserContext = () => {
	const ctx = useContext(UserContext);

	if (!ctx) throw new Error("Unable to get user context!");

	return ctx;
};

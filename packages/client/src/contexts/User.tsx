import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import type { ActorData, Community } from "@colibri-social/lib";
import {
	createContext,
	createEffect,
	createResource,
	Match,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
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
			xrpc: XrpcClient;
	  });

type LoggedInUser = Extract<User, { loggedIn: true }> & {
	/** Re-fetches the user's community list and updates the context. */
	refetchCommunities: () => Promise<void>;
	/** Patches display-name and description in the local actor data without a full refetch. */
	updateActorData: (patch: {
		displayName?: string;
		description?: string;
	}) => void;
};

export const UserContext = createContext<LoggedInUser>();

export const UserContextProvider: ParentComponent = (props) => {
	const client = useAuthContext();

	const [user, { mutate }] = createResource(async (): Promise<User> => {
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
			xrpc: xrpc,
		};
	});

	createEffect(() => {
		if (user.loading === true) return;

		const loggedIn = user()?.loggedIn;
		const pathname = () => window.location.pathname;

		if (!loggedIn && pathname() !== "/app/login") {
			window.location.href = "/app/login";
		}

		console.log(user());
	});

	return (
		<Switch>
			<Match when={user.error}>
				<span>{`${user.error}`}</span>
			</Match>
			<Match when={user.loading}>
				<AppLoadingScreen message="Fetching user details..." />
			</Match>
			<Match when={user()}>
				{(resolved) => {
					const value = resolved();

					if (!value.loggedIn) {
						return <AppLoadingScreen message="Not logged in!" />;
					}

					const refetchCommunities = async () => {
						const res = await value.xrpc.social.colibri.actor.listCommunities();
						if (res) {
							mutate({ ...value, communities: res.communities });
						}
					};

					const updateActorData = (patch: {
						displayName?: string;
						description?: string;
					}) => {
						mutate({
							...value,
							data: { ...value.data, ...patch },
						});
					};

					return (
						<UserContext.Provider
							value={{ ...value, refetchCommunities, updateActorData }}
						>
							{props.children}
						</UserContext.Provider>
					);
				}}
			</Match>
		</Switch>
	);
};

export const useUserContext = (): LoggedInUser => {
	const ctx = useContext(UserContext);

	if (!ctx) {
		throw new Error("Unable to get user context.");
	}

	return ctx;
};

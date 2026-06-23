import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import type { ActorData, Community } from "@colibri-social/lib";
import {
	createContext,
	createEffect,
	createResource,
	Match,
	onCleanup,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { XrpcClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { useAuthContext } from "./Auth";
import { useSocketContext } from "./Socket";

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
	/** Patches fields in the local actor data without a full refetch. */
	updateActorData: (patch: Partial<ActorData["data"]>) => void;
};

export const UserContext = createContext<LoggedInUser>();

export const UserContextProvider: ParentComponent = (props) => {
	const client = useAuthContext();
	const socket = useSocketContext();

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

		console.info("User loaded:", user());
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

					const updateActorData = (patch: Partial<ActorData["data"]>) => {
						mutate({
							...value,
							data: { ...value.data, ...patch },
						});
					};

					const cleanup = socket.onEvent((event) => {
						// A `member_event { join }` for the local user means we were
						// just admitted to a community (auto-admit or an approved
						// application). The current view's community context only
						// updates the member list for the community it's already
						// showing, so the sidebar's community list needs its own
						// refresh here.
						if (
							event.type === "member_event" &&
							event.data &&
							event.data.event === "join" &&
							event.data.member.did === value.did
						) {
							void refetchCommunities();
							return;
						}

						// Keep our own actor data in sync when a user_event for our DID
						// arrives (e.g. a profile/status change made from another
						// device). Community.tsx patches the member roster; this patches
						// the user context so the own-user panel (name/avatar/status)
						// updates too.
						if (
							event.type === "user_event" &&
							event.data &&
							event.data.did === value.did
						) {
							const current = user();
							if (!current?.loggedIn) return;
							const { profile, status } = event.data;
							mutate({
								...current,
								handle: profile.handle ?? current.handle,
								data: {
									...current.data,
									...(profile.displayName !== undefined && {
										displayName: profile.displayName,
									}),
									...(profile.avatar !== undefined && {
										avatar: profile.avatar,
									}),
									...(profile.banner !== undefined && {
										banner: profile.banner,
									}),
									...(profile.description !== undefined && {
										description: profile.description,
									}),
									...(status && {
										onlineState: status.state,
										status: { text: status.text, emoji: status.emoji },
									}),
								},
							});
						}
					});
					onCleanup(cleanup);

					return (
						<UserContext.Provider
							value={{
								...value,
								// `value` is captured once by this (non-keyed) Match render
								// prop, so a plain spread would freeze these fields. Expose
								// them as getters that read back through the resource signal,
								// so `mutate()` (refetchCommunities / updateActorData)
								// reactively re-renders consumers — e.g. the sidebar's <For>
								// and the own-user panel's name/avatar.
								get communities() {
									const u = user();
									return u?.loggedIn ? u.communities : value.communities;
								},
								get data() {
									const u = user();
									return u?.loggedIn ? u.data : value.data;
								},
								get handle() {
									const u = user();
									return u?.loggedIn ? u.handle : value.handle;
								},
								refetchCommunities,
								updateActorData,
							}}
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

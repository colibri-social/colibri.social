import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import type { ActorData, Community } from "@colibri-social/lib";
import {
	createContext,
	createEffect,
	createResource,
	Match,
	onCleanup,
	onMount,
	type ParentComponent,
	Show,
	Switch,
	useContext,
} from "solid-js";
import { namespace } from "../atproto/cache/keys";
import {
	cacheEnabled,
	ensureFresh,
	readUser,
	writeUser,
} from "../atproto/cache/store";
import { XrpcClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppViewUnreachableModal } from "../components/app/AppViewUnreachableModal";
import { PENDING_INVITE_KEY } from "../components/app/community/invite-storage";
import { ProfileGate } from "../components/app/onboarding/ProfileGate";
import { getAppViewDid, getAppViewServiceRef } from "../utils/appview";
import { markBoot } from "../utils/perf";
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

		const xrpc = new XrpcClient(getAppViewServiceRef(), client.agent);

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

		if (!communities.communities && import.meta.env.DEV) {
			throw new Error(
				"Actor communities response was faulty. This often happens when backfill isn't complete yet. Check your local AppView logs.",
			);
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

	onMount(async () => {
		if (!cacheEnabled() || !client?.loggedIn) return;
		const did = client.agent.did;
		if (!did) return;
		const ns = namespace(getAppViewDid(), did);
		await ensureFresh(ns);
		const cached = await readUser(ns);
		if (cached && user.loading) {
			mutate({
				loggedIn: true,
				...cached.actorData,
				atproto: {
					agent: client.agent,
					client: client.client,
					pdsHost: client.pdsHost,
				},
				communities: cached.communities,
				xrpc: new XrpcClient(getAppViewServiceRef(), client.agent),
			});
		}
	});

	let cacheWriteTimer: ReturnType<typeof setTimeout> | undefined;
	createEffect(() => {
		const u = user.latest;
		if (!cacheEnabled() || user.loading || !u?.loggedIn || !client?.loggedIn) {
			return;
		}
		const did = client.agent.did;
		if (!did) return;
		const ns = namespace(getAppViewDid(), did);
		const snapshot = {
			actorData: { did: u.did, handle: u.handle, data: u.data },
			communities: u.communities,
		};
		if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
		cacheWriteTimer = setTimeout(() => void writeUser(ns, snapshot), 500);
	});
	onCleanup(() => {
		if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
	});

	createEffect(() => {
		if (user.loading === true) return;

		markBoot("user:ready");

		const loggedIn = user()?.loggedIn;
		const pathname = () => window.location.pathname;

		if (!loggedIn && pathname() !== "/app/login") {
			const inviteMatch = pathname().match(/^\/app\/invite\/([^/]+)/);
			if (inviteMatch) {
				try {
					localStorage.setItem(
						PENDING_INVITE_KEY,
						decodeURIComponent(inviteMatch[1]),
					);
				} catch {}
			}
			window.location.href = "/app/login";
		}

		console.info("[user] User loaded:", user());
	});

	return (
		<Switch>
			<Match when={user.error}>
				<Show
					when={!import.meta.env.DEV}
					fallback={<span>{`${user.error}`}</span>}
				>
					<AppViewUnreachableModal />
				</Show>
			</Match>
			<Match when={user.loading && !user.latest}>
				<AppLoadingScreen message="Fetching user details..." />
			</Match>
			<Match when={user.latest}>
				{(resolved) => {
					const value = resolved();

					if (!value.loggedIn) {
						return <AppLoadingScreen message="Not logged in!" />;
					}

					const refetchCommunities = async () => {
						try {
							const res =
								await value.xrpc.social.colibri.actor.listCommunities();
							const cur = user.latest;
							if (res && cur?.loggedIn) {
								mutate({ ...cur, communities: res.communities });
							}
						} catch (err) {
							console.error(err);
						}
					};

					const updateActorData = (patch: Partial<ActorData["data"]>) => {
						const cur = user.latest;
						if (!cur?.loggedIn) return;
						mutate({
							...cur,
							data: { ...cur.data, ...patch },
						});
					};

					const cleanup = socket.onEvent((event) => {
						if (
							event.type === "member_event" &&
							event.data &&
							event.data.event === "join" &&
							event.data.member.did === value.did
						) {
							void refetchCommunities();
							return;
						}

						if (
							event.type === "community_event" &&
							event.data &&
							event.data.event === "upsert"
						) {
							const { data } = event;
							const current = user.latest;
							if (!current?.loggedIn) return;
							mutate({
								...current,
								communities: current.communities.map((c) =>
									c.uri === data.uri
										? {
												...c,
												...(data.name !== undefined && { name: data.name }),
												...(data.picture !== undefined && {
													picture: data.picture,
												}),
											}
										: c,
								),
							});
							return;
						}

						if (
							event.type === "user_event" &&
							event.data &&
							event.data.did === value.did
						) {
							const current = user.latest;
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
									...(profile.theme !== undefined && {
										theme: profile.theme,
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
									const u = user.latest;
									return u?.loggedIn ? u.communities : value.communities;
								},
								get data() {
									const u = user.latest;
									return u?.loggedIn ? u.data : value.data;
								},
								get handle() {
									const u = user.latest;
									return u?.loggedIn ? u.handle : value.handle;
								},
								refetchCommunities,
								updateActorData,
							}}
						>
							<ProfileGate>{props.children}</ProfileGate>
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

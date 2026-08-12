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
import { syncPresenceService } from "../atproto/presence";
import { sessionDead } from "../atproto/session-health";
import { XrpcClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppViewUnreachableModal } from "../components/app/AppViewUnreachableModal";
import { ProfileGate } from "../components/app/onboarding/ProfileGate";
import { SessionExpiredScreen } from "../components/app/SessionExpiredScreen";
import { setReportingAccount } from "../errors/account";
import { classifyThrown } from "../errors/classify";
import { setCrossAppViewHintHandlers } from "../errors/cross-appview-hint";
import { ColibriError } from "../errors/error";
import { showError } from "../errors/show-error";
import { identifyUser } from "../sentry";
import { getAppViewDid, getAppViewServiceRef } from "../utils/appview";
import { createLogger } from "../utils/logger";
import { markBoot } from "../utils/perf";
import { useAuthContext } from "./Auth";
import { useSocketContext } from "./Socket";
import { useUserPreferences } from "./UserPreferences";

const log = createLogger("user");

type User =
	| { loggedIn: false; atproto: { client: BrowserOAuthClient } }
	| (ActorData & {
			loggedIn: true;
			atproto: {
				client: BrowserOAuthClient;
				agent: Agent;
				pdsHost: string | undefined;
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
	const { preferences, setSharePresence, setHideCrossAppViewHint } =
		useUserPreferences();
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

		const [actorDataRes, communitiesRes] = await Promise.all([
			xrpc.social.colibri.actor.getData(client.agent.did!),
			xrpc.social.colibri.actor.listCommunities(),
		]);

		if (!actorDataRes.ok) throw actorDataRes.error;
		if (!communitiesRes.ok) throw communitiesRes.error;

		const actorData = actorDataRes.data;
		const communities = communitiesRes.data;

		if (!actorData) {
			throw new ColibriError({ code: "MalformedResponse" });
		}

		if (!communities) {
			throw new ColibriError({ code: "MalformedResponse" });
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
		const current = user.latest?.loggedIn ? user.latest : undefined;
		setCrossAppViewHintHandlers({
			isSuppressed: () => preferences().hideCrossAppViewHint,
			suppressPermanently: () => setHideCrossAppViewHint(true),
			enablePresenceSharing: async () => {
				if (!current) return;
				setSharePresence(true);
				try {
					await syncPresenceService(current.atproto.agent, current.did, true);
				} catch (err) {
					setSharePresence(false);
					showError(err, {
						fallbackTitle: "Couldn't turn on presence sharing.",
					});
				}
			},
		});
	});

	createEffect(() => {
		const attach = preferences().attachAccountToReports;
		const did = user.latest?.loggedIn ? user.latest.did : undefined;
		identifyUser(attach ? did : undefined);
		setReportingAccount({ did, optedIn: attach });
	});

	createEffect(() => {
		if (user.loading === true) return;

		markBoot("user:ready");
		log.info("user loaded");
	});

	const needsSignIn = () =>
		sessionDead() || classifyThrown(user.error).needsReauth;

	return (
		<Switch>
			<Match when={user.error}>
				<Switch fallback={<AppViewUnreachableModal />}>
					<Match when={needsSignIn()}>
						<SessionExpiredScreen />
					</Match>
					<Match when={import.meta.env.DEV}>
						<span>{`${user.error}`}</span>
					</Match>
				</Switch>
			</Match>
			<Match when={user.loading && !user.latest}>
				<AppLoadingScreen message="Fetching user details..." />
			</Match>
			<Match when={user.latest}>
				{(resolved) => {
					const value = resolved();

					if (!value.loggedIn) {
						return <SessionExpiredScreen />;
					}

					const refetchCommunities = async () => {
						try {
							const res =
								await value.xrpc.social.colibri.actor.listCommunities();
							const cur = user.latest;
							if (res.ok && res.data && cur?.loggedIn) {
								mutate({ ...cur, communities: res.data.communities });
							}
						} catch (err) {
							log.error("refetching communities failed", {
								code: classifyThrown(err).code,
							});
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
												picture: data.picture,
												banner: data.banner,
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

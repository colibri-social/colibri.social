import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
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
import { colibri } from "../atproto/lexicons";
import {
	ensurePreferencesSpace,
	grantPreferencesAccess,
	scheduleRegrant,
} from "../atproto/preferences-space";
import {
	configureReadCursorWriter,
	resetReadCursorWriter,
} from "../atproto/read-cursor";
import { sessionDead } from "../atproto/session-health";
import { frameIs } from "../atproto/sync-frames";
import type { CommunityView, ProfileView } from "../atproto/views";
import { type ColibriClient, primaryClient } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppViewUnreachableModal } from "../components/app/AppViewUnreachableModal";
import { ProfileGate } from "../components/app/onboarding/ProfileGate";
import { SessionExpiredRedirect } from "../components/app/SessionExpiredRedirect";
import { setReportingAccount } from "../errors/account";
import { classifyThrown } from "../errors/classify";
import { ColibriError } from "../errors/error";
import { identifyUser } from "../sentry";
import { getAppViewDid } from "../utils/appview";
import { createLogger } from "../utils/logger";
import { markBoot } from "../utils/perf";
import { useAuthContext } from "./Auth";
import { useSocketContext } from "./Socket";
import { useUserPreferences } from "./UserPreferences";

const log = createLogger("user");

type User =
	| { loggedIn: false; atproto: { client: BrowserOAuthClient } }
	| (ProfileView & {
			loggedIn: true;
			atproto: {
				client: BrowserOAuthClient;
				agent: Agent;
				pdsHost: string | undefined;
			};
			communities: Array<CommunityView>;
			xrpc: ColibriClient;
	  });

export type LoggedInUser = Extract<User, { loggedIn: true }> & {
	/** Re-fetches the user's community list and updates the context. */
	refetchCommunities: () => Promise<void>;
	/**
	 * Re-reads the profile from the AppView. Needed after writing the profile
	 * record to the user's own repo, because there is no announce endpoint for it.
	 * The AppView reads your own profile straight from your PDS rather than from
	 * its cache, so this returns the record you just wrote.
	 */
	refetchProfile: () => Promise<void>;
	/** Patches fields in the local actor data without a full refetch. */
	updateProfile: (patch: Partial<ProfileView>) => void;
};

export const UserContext = createContext<LoggedInUser>();

export const UserContextProvider: ParentComponent = (props) => {
	const client = useAuthContext();
	const { preferences } = useUserPreferences();
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

		const xrpc = primaryClient(client.agent);

		const [actorDataRes, communitiesRes] = await Promise.all([
			xrpc.call(colibri.actor.getProfile.main, {
				params: { actor: client.agent.did as string },
			}),
			xrpc.call(colibri.actor.listCommunities.main, {}),
		]);

		if (!actorDataRes.ok) throw actorDataRes.error;
		if (!communitiesRes.ok) throw communitiesRes.error;

		const profile = actorDataRes.data?.profile;
		const communities = communitiesRes.data;

		if (!profile) {
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
			...profile,
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
				...cached.profile,
				atproto: {
					agent: client.agent,
					client: client.client,
					pdsHost: client.pdsHost,
				},
				communities: cached.communities,
				xrpc: primaryClient(client.agent),
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
		const {
			atproto: _atproto,
			xrpc: _xrpc,
			loggedIn: _loggedIn,
			communities,
			...profile
		} = u;
		const snapshot = { profile, communities };
		if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
		cacheWriteTimer = setTimeout(() => void writeUser(ns, snapshot), 500);
	});
	onCleanup(() => {
		if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
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
						<SessionExpiredRedirect />
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
						return <SessionExpiredRedirect />;
					}

					const refetchCommunities = async () => {
						try {
							const res = await value.xrpc.call(
								colibri.actor.listCommunities.main,
								{},
							);
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

					const refetchProfile = async () => {
						try {
							const res = await value.xrpc.call(colibri.actor.getProfile.main, {
								params: { actor: value.did },
							});
							const cur = user.latest;
							if (res.ok && cur?.loggedIn) {
								mutate({ ...cur, ...res.data.profile });
							}
						} catch (err) {
							log.error("refetching the profile failed", {
								code: classifyThrown(err).code,
							});
						}
					};

					const liveProfile = (): ProfileView => {
						const u = user.latest;
						return u?.loggedIn ? u : value;
					};

					const updateProfile = (patch: Partial<ProfileView>) => {
						const cur = user.latest;
						if (!cur?.loggedIn) return;
						mutate({ ...cur, ...patch });
					};

					onMount(() => {
						const { agent } = value.atproto;
						let cancelRegrant: (() => void) | undefined;

						configureReadCursorWriter({
							agent,
							xrpc: value.xrpc,
							actorDid: value.did,
						});

						void (async () => {
							try {
								await ensurePreferencesSpace(agent);
							} catch {
								return;
							}
							const grant = await grantPreferencesAccess(agent, value.xrpc);
							if (grant) {
								cancelRegrant = scheduleRegrant(
									agent,
									value.xrpc,
									grant.expiresAt,
								);
							}
						})();

						onCleanup(() => {
							cancelRegrant?.();
							resetReadCursorWriter();
						});
					});

					let wasConnected = socket.connected();
					createEffect(() => {
						const isConnected = socket.connected();
						const reconnected = isConnected && !wasConnected;
						wasConnected = isConnected;
						if (reconnected) void refetchCommunities();
					});

					const cleanup = socket.onEvent((event) => {
						if (frameIs(event, "memberEvent")) {
							if (
								event.event === "join" &&
								event.member?.actor.did === value.did
							) {
								void refetchCommunities();
							}
							return;
						}

						if (frameIs(event, "communityEvent")) {
							const current = user.latest;
							if (!current?.loggedIn) return;

							if (event.event === "delete") {
								mutate({
									...current,
									communities: current.communities.filter(
										(c) => c.did !== event.community,
									),
								});
								return;
							}

							const view = event.view;
							if (!view) {
								void refetchCommunities();
								return;
							}
							mutate({
								...current,
								communities: current.communities.map((c) =>
									c.did === view.did ? view : c,
								),
							});
							return;
						}

						if (frameIs(event, "presenceEvent") && event.did === value.did) {
							const current = user.latest;
							if (!current?.loggedIn) return;
							mutate({ ...current, presence: event.presence });
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
								// so `mutate()` (refetchCommunities / updateProfile)
								// reactively re-renders consumers — e.g. the sidebar's <For>
								// and the own-user panel's name/avatar.
								get communities() {
									const u = user.latest;
									return u?.loggedIn ? u.communities : value.communities;
								},
								get handle() {
									return liveProfile().handle;
								},
								get displayName() {
									return liveProfile().displayName;
								},
								get description() {
									return liveProfile().description;
								},
								get avatar() {
									return liveProfile().avatar;
								},
								get banner() {
									return liveProfile().banner;
								},
								get isBot() {
									return liveProfile().isBot;
								},
								get syncBluesky() {
									return liveProfile().syncBluesky;
								},
								get theme() {
									return liveProfile().theme;
								},
								get preferredBadge() {
									return liveProfile().preferredBadge;
								},
								get presence() {
									return liveProfile().presence;
								},
								refetchCommunities,
								refetchProfile,
								updateProfile,
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

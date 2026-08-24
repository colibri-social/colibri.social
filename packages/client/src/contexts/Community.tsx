import { useNavigate } from "@solidjs/router";
import {
	type Accessor,
	createContext,
	createEffect,
	createMemo,
	createResource,
	createSignal,
	Match,
	on,
	onCleanup,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { evictCommunity } from "../atproto/cache/community-evict";
import {
	recallCommunity,
	rememberCommunity,
} from "../atproto/cache/community-memory";
import {
	isCommunityGone,
	isCommunityInert,
} from "../atproto/cache/community-tombstone";
import { communityKey, namespace } from "../atproto/cache/keys";
import type { CommunitySnapshot } from "../atproto/cache/schema";
import {
	cacheEnabled,
	readCommunity,
	writeCommunity,
} from "../atproto/cache/store";
import { colibri } from "../atproto/lexicons";
import {
	APPROVAL_MANAGE,
	CATEGORY_CREATE,
	CATEGORY_DELETE,
	CATEGORY_UPDATE,
	CHANNEL_CREATE,
	CHANNEL_DELETE,
	CHANNEL_UPDATE,
	COMMUNITY_DELETE,
	COMMUNITY_MANAGE,
	getPermissionCeiling,
	grantsPermission,
	INVITATION_CREATE,
	INVITATION_DELETE,
	isRoleBelowCeiling,
	LABEL_APPLY,
	MEMBER_BAN,
	MEMBER_KICK,
	MEMBER_UNBAN,
	MENTION_ROLES,
	MODERATION_VIEW_LOG,
	ROLE_MANAGE,
	VOICE_MODERATE,
} from "../atproto/permissions";
import { frameIs } from "../atproto/sync-frames";
import type { MemberView } from "../atproto/views";
import { type ColibriClient, clientForManagingApp } from "../atproto/xrpc";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { ErrorState } from "../components/ErrorState";
import type { ColibriErrorCode } from "../errors/codes";
import { ColibriError } from "../errors/error";
import { showError } from "../errors/show-error";
import { getAppViewDid } from "../utils/appview";
import { getCommunityParam } from "../utils/get-param";
import { createMemberIndex } from "../utils/member-search";
import { markBoot } from "../utils/perf";
import { speakerRanks } from "../utils/recent-speakers";
import { communityAccessCode } from "./community-access";
import { decideCommunityExit } from "./community-exit";
import {
	type Applicant,
	type Category,
	type Channel,
	type CommunityPayload,
	emptyCommunityPayload,
	type Member,
	type MemberData,
	patchMemberData,
	payloadForCommunity,
	type Role,
	sameRoles,
	toApplicant,
	toMember,
	withMemberPresence,
} from "./community-payload";
import { trackCommunityRefresh } from "./community-refresh-state";
import {
	communityResolveState,
	isCommunityResolving,
} from "./community-resolve";
import { createLoadSessions } from "./load-session";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";
import { useVoiceChatContext } from "./VoiceChat";

type CommunityContextData = CommunityPayload & {
	assignableRoles: Array<Role>;
	applications: Array<Applicant>;
	dismissedApplications: Array<Applicant>;
	ownerDid: Accessor<string | undefined>;
	authoritative: Accessor<boolean>;
	utils: {
		getMember: (did: string) => Member | undefined;
		getRole: (rkey: string) => Role | undefined;
		getRolesForUser: (did: string) => Array<Role>;
		setRolesForUser: (did: string, roles: Array<string>) => void;
		patchChannel: (space: string, patch: Partial<Channel>) => void;
		patchCategory: (rkey: string, patch: Partial<Category>) => void;
		patchCommunity: (community: CommunityPayload["community"]) => void;
		patchMember: (did: string, patch: Partial<MemberData>) => void;
		searchMembers: (query: string, limit: number) => Array<Member>;
		refetch: () => void;
		refetchApplications: () => void;
	};
};

const OVERLAY_DELAY = 250;

const REFRESH_RETRY_DELAYS = [1000, 2000, 4000, 8000];

const COMMUNITY_CALL_TIMEOUT = 45_000;

const STALL_AFTER = 60_000;

const MEMBER_PAGE_SIZE = 100;

const MAX_MEMBER_PAGES = 100;

const MEMBER_ONLY_EXPECTED: ReadonlyArray<ColibriErrorCode> = [
	"Forbidden",
	"Banned",
	"NotAMember",
];

export const CommunityContext = createContext<Accessor<CommunityContextData>>();

const listAllMembers = async (
	client: ColibriClient,
	did: string,
	signal: AbortSignal,
	expected: ReadonlyArray<ColibriErrorCode>,
): Promise<Array<MemberView>> => {
	const members: Array<MemberView> = [];
	let cursor: string | undefined;
	let pages = 0;

	do {
		const res = await client.call(
			colibri.community.listMembers.main,
			{ params: { community: did, limit: MEMBER_PAGE_SIZE, cursor } },
			{ signal, timeoutMs: COMMUNITY_CALL_TIMEOUT, expected },
		);
		if (!res.ok) throw res.error;
		members.push(...res.data.members);

		const next = res.data.cursor;
		if (next === cursor) break;
		cursor = next;

		pages += 1;
		if (pages >= MAX_MEMBER_PAGES && cursor) {
			throw new ColibriError({
				code: "UpstreamFailure",
				method: colibri.community.listMembers.main.nsid,
			});
		}
	} while (cursor);

	return members;
};

export const CommunityContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const navigate = useNavigate();
	const [, { syncPresence, addPresence, presenceMark }] = useVoiceChatContext();
	const communityIdentifier = createMemo(() => getCommunityParam());

	const pendingRoleIntents = new Map<string, Array<string>>();

	let lastFetched: CommunityPayload | undefined;
	let lastFetchedMark = 0;

	const [fetchedCommunity, setFetchedCommunity] = createSignal<
		CommunityPayload | undefined
	>();

	const [snapshot, setSnapshot] = createSignal<CommunityPayload | undefined>();

	const ns = () => namespace(getAppViewDid(), user.did);

	const sessions = createLoadSessions(() => ({}));
	onCleanup(() => sessions.dispose());

	const [settledIdentifier, setSettledIdentifier] = createSignal<string>();

	const cacheKey = (identifier: string) => communityKey(ns(), identifier);

	const cacheCommunity = (identifier: string, snap: CommunitySnapshot) => {
		if (isCommunityInert(cacheKey(identifier))) return;
		rememberCommunity(cacheKey(identifier), snap);
		if (!cacheEnabled()) return;
		void writeCommunity(ns(), identifier, snap);
	};

	const paintFromCache = async (identifier: string) => {
		const key = cacheKey(identifier);
		if (isCommunityInert(key)) return;
		const cached =
			recallCommunity(key) ?? (await readCommunity(ns(), identifier));
		if (!cached) return;
		if (fetchedCommunity()?.community.did === identifier) return;
		if (snapshot()?.community.did === identifier) return;

		setSnapshot({
			community: cached.community,
			categories: cached.categories,
			channels: cached.channels,
			roles: cached.roles,
			members: cached.members.map(toMember),
		});
	};

	createEffect(
		on(communityIdentifier, (identifier) => {
			if (!identifier) return;
			void paintFromCache(identifier);
		}),
	);

	const [community, { refetch }] = createResource(
		() => communityIdentifier() || undefined,
		async (identifier) => {
			if (isCommunityGone(cacheKey(identifier))) {
				setSettledIdentifier(identifier);
				throw new ColibriError({
					code: "CommunityNotFound",
					method: colibri.community.getCommunity.main.nsid,
				});
			}

			const session = sessions.begin(identifier);
			const mark = presenceMark();
			pendingRoleIntents.clear();
			if (fetchedCommunity()?.community.did !== identifier) {
				setFetchedCommunity(undefined);
			}

			try {
				const initial = await user.xrpc.call(
					colibri.community.getCommunity.main,
					{ params: { community: identifier } },
					{
						signal: session.supersededSignal,
						timeoutMs: COMMUNITY_CALL_TIMEOUT,
						expected: ["CommunityNotFound"],
					},
				);

				if (!initial.ok) throw initial.error;

				const communityView = initial.data.community;

				const denied = communityAccessCode(communityView.viewer);
				if (denied) {
					throw new ColibriError({
						code: denied,
						method: colibri.community.getCommunity.main.nsid,
					});
				}

				const client = clientForManagingApp(
					user.atproto.agent,
					communityView.managingApp,
				);

				const memberOnly = {
					signal: session.supersededSignal,
					timeoutMs: COMMUNITY_CALL_TIMEOUT,
					expected: MEMBER_ONLY_EXPECTED,
				};

				const [categoriesRes, channelsRes, rolesRes, members] =
					await Promise.all([
						client.call(
							colibri.community.listCategories.main,
							{ params: { community: communityView.did } },
							memberOnly,
						),
						client.call(
							colibri.community.listChannels.main,
							{ params: { community: communityView.did } },
							memberOnly,
						),
						client.call(
							colibri.community.listRoles.main,
							{ params: { community: communityView.did } },
							memberOnly,
						),
						listAllMembers(
							client,
							communityView.did,
							session.supersededSignal,
							MEMBER_ONLY_EXPECTED,
						),
					]);

				if (!categoriesRes.ok) throw categoriesRes.error;
				if (!channelsRes.ok) throw channelsRes.error;
				if (!rolesRes.ok) throw rolesRes.error;

				const payload: CommunityPayload = {
					community: communityView,
					categories: categoriesRes.data.categories,
					channels: channelsRes.data.channels,
					roles: rolesRes.data.roles,
					members: members.map(toMember),
				};

				if (!sessions.isCurrent(session)) return payload;

				cacheCommunity(identifier, {
					community: communityView,
					categories: payload.categories,
					channels: payload.channels,
					roles: payload.roles,
					members,
					ts: Date.now(),
				});

				lastFetched = payload;
				lastFetchedMark = mark;
				setFetchedCommunity(payload);
				setSnapshot(payload);
				return payload;
			} finally {
				if (sessions.isCurrent(session)) setSettledIdentifier(identifier);
			}
		},
	);

	const currentPayload = createMemo(() =>
		payloadForCommunity(snapshot(), communityIdentifier()),
	);

	const pending = createMemo(() =>
		isCommunityResolving(
			communityIdentifier(),
			community.loading,
			settledIdentifier(),
		),
	);

	const [stalled, setStalled] = createSignal(false);

	let stallTimer: ReturnType<typeof setTimeout> | undefined;

	const cancelStallTimer = () => {
		if (stallTimer) clearTimeout(stallTimer);
		stallTimer = undefined;
	};

	const armStallTimer = () => {
		cancelStallTimer();
		setStalled(false);
		stallTimer = setTimeout(() => setStalled(true), STALL_AFTER);
	};

	createEffect(
		on(pending, (isPending) => {
			cancelStallTimer();
			setStalled(false);
			if (!isPending) return;
			armStallTimer();
		}),
	);

	onCleanup(cancelStallTimer);

	const resolveState = createMemo(() =>
		communityResolveState(pending(), stalled()),
	);

	const resolving = () => resolveState() === "resolving";

	const stallError = createMemo(() =>
		resolveState() === "stalled"
			? (community.error ??
				new ColibriError({
					code: "Timeout",
					method: colibri.community.getCommunity.main.nsid,
				}))
			: undefined,
	);

	const settledError = () =>
		resolving() ? undefined : (stallError() ?? community.error);

	createEffect(() => {
		if (!community.loading && currentPayload()) markBoot("community:ready");
	});

	createEffect(() => {
		const exit = decideCommunityExit(
			resolving(),
			settledError(),
			currentPayload() !== undefined,
		);
		if (exit === "stay") return;
		if (exit === "gone") {
			const identifier = communityIdentifier();
			const error = settledError();
			const listed = user.communities.some((c) => c.did === identifier);
			const expectedLocally = isCommunityInert(cacheKey(identifier));
			evictCommunity(ns(), identifier);
			user.dropCommunity(identifier);
			if (error && listed && !expectedLocally) {
				showError(error, { report: false });
			}
		}
		navigate("/app", { replace: true });
	});

	const MEMBERSHIP_RETRY_DELAYS = [1000, 2000, 4000, 8000];
	let membershipRetries = 0;
	let membershipRetryTimer: ReturnType<typeof setTimeout> | undefined;

	const cancelMembershipRetry = () => {
		if (membershipRetryTimer) clearTimeout(membershipRetryTimer);
		membershipRetryTimer = undefined;
	};

	let refreshRetries = 0;
	let refreshRetryTimer: ReturnType<typeof setTimeout> | undefined;

	const cancelRefreshRetry = () => {
		if (refreshRetryTimer) clearTimeout(refreshRetryTimer);
		refreshRetryTimer = undefined;
	};

	createEffect(
		on(communityIdentifier, () => {
			cancelMembershipRetry();
			membershipRetries = 0;
			cancelRefreshRetry();
			refreshRetries = 0;
		}),
	);

	createEffect(() => {
		if (resolving()) return;
		if (settledError() === undefined || currentPayload() === undefined) {
			cancelRefreshRetry();
			refreshRetries = 0;
			return;
		}
		const delay = REFRESH_RETRY_DELAYS[refreshRetries];
		if (delay === undefined || refreshRetryTimer) return;
		refreshRetries += 1;
		refreshRetryTimer = setTimeout(() => {
			refreshRetryTimer = undefined;
			requestRefetch();
		}, delay);
	});

	onCleanup(cancelRefreshRetry);

	trackCommunityRefresh(
		() => settledError() !== undefined && currentPayload() !== undefined,
	);

	let syncedPayload: CommunityPayload | undefined;
	createEffect(() => {
		const identifier = communityIdentifier();
		const data = currentPayload();

		if (!identifier || !data || community.loading) return;
		if (data !== lastFetched || data === syncedPayload) return;

		syncedPayload = data;
		syncPresence(data.community.did, data.members, lastFetchedMark);

		if (data.members.some((m) => m.did === user.did)) {
			cancelMembershipRetry();
			membershipRetries = 0;
			return;
		}

		const delay = MEMBERSHIP_RETRY_DELAYS[membershipRetries];
		if (delay === undefined || membershipRetryTimer) return;

		membershipRetries += 1;
		membershipRetryTimer = setTimeout(() => {
			membershipRetryTimer = undefined;
			if (communityIdentifier() === identifier) requestRefetch();
		}, delay);
	});

	onCleanup(cancelMembershipRetry);

	let wasConnected = socket.connected();
	createEffect(() => {
		const isConnected = socket.connected();
		const reconnected = isConnected && !wasConnected;
		wasConnected = isConnected;
		if (reconnected && lastFetched) {
			cancelRefreshRetry();
			refreshRetries = 0;
			requestRefetch();
		}
	});

	createEffect(() => {
		const data = currentPayload();
		const identifier = communityIdentifier();
		if (community.loading || !data || !identifier) return;

		const cached = recallCommunity(communityKey(ns(), identifier));
		if (!cached || cached.community === data.community) return;
		cacheCommunity(identifier, { ...cached, community: data.community });
	});

	const [applications, { refetch: refetchApplications }] = createResource(
		() => {
			const authoritative = fetchedCommunity();
			if (!authoritative?.community.requiresApprovalToJoin) return undefined;
			if (isCommunityInert(cacheKey(communityIdentifier()))) return undefined;
			const permissions = authoritative.community.viewer.permissions ?? [];
			return permissions.includes(APPROVAL_MANAGE)
				? communityIdentifier()
				: undefined;
		},
		async () => {
			const authoritative = fetchedCommunity();
			if (!authoritative) return { applications: [], dismissed: [] };

			const client = clientForManagingApp(
				user.atproto.agent,
				authoritative.community.managingApp,
			);
			const res = await client.call(
				colibri.community.listApplications.main,
				{
					params: {
						community: authoritative.community.did,
						includeDismissed: true,
					},
				},
				{ signal: sessions.teardownSignal, timeoutMs: COMMUNITY_CALL_TIMEOUT },
			);
			if (!res.ok) throw res.error;

			const all = res.data.applications.map(toApplicant);
			return {
				applications: all.filter((a) => !a.dismissed),
				dismissed: all.filter((a) => a.dismissed),
			};
		},
		{ initialValue: { applications: [], dismissed: [] } },
	);

	const applicationQueues = () =>
		applications.error !== undefined ? undefined : applications.latest;

	const requestRefetch = () => {
		const identifier = communityIdentifier();
		if (identifier === "") return;
		if (isCommunityInert(cacheKey(identifier))) return;
		void refetch();
	};

	const requestRefetchApplications = () => {
		const identifier = communityIdentifier();
		if (identifier === "") return;
		if (isCommunityInert(cacheKey(identifier))) return;
		void refetchApplications();
	};

	const cleanup = socket.onEvent((event) => {
		const prev = currentPayload();
		if (!prev) return;
		const did = prev.community.did;

		if (frameIs(event, "presenceEvent")) {
			setSnapshot({
				...prev,
				members: prev.members.map((m) =>
					m.did === event.did ? withMemberPresence(m, event.presence) : m,
				),
			});
		} else if (frameIs(event, "memberEvent")) {
			if (event.community !== did) return;

			if (event.event === "join" && event.member) {
				const member = toMember(event.member);
				if (prev.members.some((m) => m.did === member.did)) return;
				setSnapshot({ ...prev, members: [...prev.members, member] });
				addPresence(member);
				if (applicationQueues() !== undefined) requestRefetchApplications();
			} else if (event.event === "update" && event.member) {
				const member = toMember(event.member);
				const intent = pendingRoleIntents.get(member.did);
				if (intent) {
					const confirmsIntent =
						intent.length === member.roles.length &&
						intent.every((rkey) => member.roles.includes(rkey));
					if (!confirmsIntent) return;
					pendingRoleIntents.delete(member.did);
				}
				const previous = prev.members.find((m) => m.did === member.did);
				setSnapshot({
					...prev,
					members: prev.members.map((m) => (m.did === member.did ? member : m)),
				});
				if (
					member.did === user.did &&
					!sameRoles(previous?.roles, member.roles)
				) {
					requestRefetch();
				}
			} else if (event.event === "leave" && event.subject) {
				const subject = event.subject;
				setSnapshot({
					...prev,
					members: prev.members.filter((m) => m.did !== subject),
				});
			}
		} else if (frameIs(event, "applicationEvent")) {
			if (event.community !== did) return;
			requestRefetchApplications();
		} else if (frameIs(event, "communityEvent")) {
			if (event.community !== did) return;
			if (event.event === "delete") return;
			if (event.view) setSnapshot({ ...prev, community: event.view });
			else requestRefetch();
		} else if (frameIs(event, "categoryEvent")) {
			if (event.community !== did) return;
			requestRefetch();
		} else if (frameIs(event, "channelEvent")) {
			if (event.community !== did) return;
			requestRefetch();
		} else if (frameIs(event, "roleEvent")) {
			if (event.community !== did) return;
			requestRefetch();
		}
	});

	onCleanup(cleanup);

	const payload = createMemo(() => currentPayload() ?? emptyCommunityPayload());

	const assignableRoles = createMemo(() =>
		payload().roles.filter((role) => !role.protected),
	);

	const membersByDid = createMemo(
		() => new Map(payload().members.map((m) => [m.did, m])),
	);

	const rolesByRkey = createMemo(
		() => new Map(payload().roles.map((r) => [r.rkey, r])),
	);

	const getMember = (did: string) => membersByDid().get(did);
	const getRole = (rkey: string) => rolesByRkey().get(rkey);

	const memberIndex = createMemberIndex();

	createEffect(() => memberIndex.sync(payload().members));

	const searchMembers = (query: string, limit: number): Array<Member> => {
		const ranks = speakerRanks(communityIdentifier());
		const byDid = membersByDid();

		if (!query.trim()) {
			const recent = ranks
				.top(limit)
				.map((did) => byDid.get(did))
				.filter((member): member is Member => member !== undefined);

			if (recent.length >= limit) return recent;

			const seen = new Set(recent.map((member) => member.did));
			return [
				...recent,
				...payload()
					.members.filter((member) => !seen.has(member.did))
					.slice(0, limit - recent.length),
			];
		}

		return memberIndex
			.search(query, limit, ranks)
			.map((did) => byDid.get(did))
			.filter((member): member is Member => member !== undefined);
	};

	const getRolesForUser = (did: string) => {
		const member = membersByDid().get(did);
		if (!member) return [];

		return assignableRoles()
			.filter((role) => member.roles.includes(role.rkey))
			.sort((a, b) => b.position - a.position);
	};

	const setRolesForUser = (did: string, roles: Array<string>) => {
		const prev = currentPayload();
		if (!prev) return;
		pendingRoleIntents.set(did, roles);
		setSnapshot({
			...prev,
			members: prev.members.map((m) => (m.did === did ? { ...m, roles } : m)),
		});
	};

	const patchChannel = (space: string, patch: Partial<Channel>) => {
		const prev = currentPayload();
		if (!prev?.channels.some((c) => c.space === space)) return;
		const apply = (c: Channel): Channel =>
			c.space === space ? { ...c, ...patch } : c;
		setSnapshot({
			...prev,
			channels: prev.channels.map(apply),
			categories: prev.categories.map((cat) => ({
				...cat,
				channels: cat.channels.map(apply),
			})),
		});
	};

	const patchCategory = (rkey: string, patch: Partial<Category>) => {
		const prev = currentPayload();
		if (!prev?.categories.some((c) => c.rkey === rkey)) return;
		setSnapshot({
			...prev,
			categories: prev.categories.map((c) =>
				c.rkey === rkey ? { ...c, ...patch } : c,
			),
		});
	};

	const patchCommunity = (community: CommunityPayload["community"]) => {
		const prev = currentPayload();
		if (!prev) return;
		setSnapshot({ ...prev, community });
	};

	const patchMember = (did: string, patch: Partial<MemberData>) => {
		const prev = currentPayload();
		if (!prev?.members.some((m) => m.did === did)) return;
		setSnapshot({
			...prev,
			members: prev.members.map((m) =>
				m.did === did ? patchMemberData(m, patch) : m,
			),
		});
	};

	const authoritative = createMemo(() => {
		const identifier = communityIdentifier();
		return (
			identifier !== "" && fetchedCommunity()?.community.did === identifier
		);
	});

	const ownerRole = createMemo(() => payload().roles.find((x) => x.protected));

	const ownerDid = createMemo(() => {
		const role = ownerRole()?.rkey;
		if (!role) return undefined;
		return payload().members.find((x) => x.roles.includes(role))?.did;
	});

	const value: Accessor<CommunityContextData> = createMemo(() => ({
		...payload(),
		assignableRoles: assignableRoles(),
		applications: applicationQueues()?.applications ?? [],
		dismissedApplications: applicationQueues()?.dismissed ?? [],
		ownerDid,
		authoritative,
		utils: {
			getMember,
			getRole,
			getRolesForUser,
			setRolesForUser,
			patchChannel,
			patchCategory,
			patchCommunity,
			patchMember,
			searchMembers,
			refetch: requestRefetch,
			refetchApplications: requestRefetchApplications,
		},
	}));

	return (
		<Switch fallback={<AppLoadingScreen message="Redirecting..." />}>
			<Match when={currentPayload()}>
				<CommunityContext.Provider value={value}>
					{props.children}
				</CommunityContext.Provider>
			</Match>
			<Match when={stallError()}>
				{(error) => (
					<ErrorState
						error={error()}
						retry={() => {
							armStallTimer();
							requestRefetch();
						}}
					/>
				)}
			</Match>
			<Match when={resolving()}>
				<AppLoadingScreen
					message="Fetching community details..."
					delay={OVERLAY_DELAY}
				/>
			</Match>
			<Match when={settledError()}>
				<ErrorState error={settledError()} retry={requestRefetch} />
			</Match>
		</Switch>
	);
};

export const useCommunityContext = (): Accessor<CommunityContextData> => {
	const ctx = useContext(CommunityContext);

	if (!ctx) {
		throw new Error("Unable to get community context.");
	}

	return ctx;
};

export const usePermissions = () => {
	const community = useCommunityContext();
	const user = useUserContext();

	const protectedRoleKey = () =>
		community().roles.find((role) => role.protected)?.rkey;

	const isOwner = (did: string): boolean => {
		const c = community();
		if (!c) return false;
		if (did === user.did && c.community.viewer.isOwner !== undefined) {
			return c.community.viewer.isOwner;
		}
		const role = protectedRoleKey();
		if (!role) return false;
		return c.utils.getMember(did)?.roles.includes(role) ?? false;
	};

	const getRank = (did: string): number => {
		const c = community();
		if (!c) return Number.NEGATIVE_INFINITY;
		if (isOwner(did)) return Number.POSITIVE_INFINITY;
		const member = c.utils.getMember(did);
		if (!member) return Number.NEGATIVE_INFINITY;
		return member.roles.reduce((max, rkey) => {
			const pos = c.utils.getRole(rkey)?.position ?? Number.NEGATIVE_INFINITY;
			return pos > max ? pos : max;
		}, Number.NEGATIVE_INFINITY);
	};

	const outranks = (actorDid: string, targetDid: string): boolean =>
		getRank(actorDid) > getRank(targetDid);

	const hasPermission = (did: string, permission: string): boolean => {
		const c = community();
		if (!c) return false;
		if (isOwner(did)) return true;
		if (did === user.did && c.community.viewer.permissions !== undefined) {
			return c.community.viewer.permissions.includes(permission);
		}
		const member = c.utils.getMember(did);
		if (!member) return false;
		return grantsPermission(c.roles, member.roles, permission);
	};

	const isAdmin = isOwner;

	const canManage = (did: string): boolean => isAdmin(did);

	const canManageCommunity = (did: string) =>
		hasPermission(did, COMMUNITY_MANAGE);
	const canDeleteCommunity = (did: string) =>
		hasPermission(did, COMMUNITY_DELETE);

	const canManageApprovals = (did: string) =>
		hasPermission(did, APPROVAL_MANAGE);

	const canCreateCategory = (did: string) =>
		hasPermission(did, CATEGORY_CREATE);
	const canUpdateCategory = (did: string) =>
		hasPermission(did, CATEGORY_UPDATE);
	const canDeleteCategory = (did: string) =>
		hasPermission(did, CATEGORY_DELETE);

	const canCreateChannel = (did: string) => hasPermission(did, CHANNEL_CREATE);
	const canUpdateChannel = (did: string) => hasPermission(did, CHANNEL_UPDATE);
	const canDeleteChannel = (did: string) => hasPermission(did, CHANNEL_DELETE);

	const canKickMember = (actorDid: string, targetDid?: string) =>
		hasPermission(actorDid, MEMBER_KICK) &&
		(targetDid === undefined || outranks(actorDid, targetDid));
	const canBanMember = (actorDid: string, targetDid?: string) =>
		hasPermission(actorDid, MEMBER_BAN) &&
		(targetDid === undefined || outranks(actorDid, targetDid));
	const canUnbanMember = (actorDid: string, targetDid?: string) =>
		hasPermission(actorDid, MEMBER_UNBAN) &&
		(targetDid === undefined || outranks(actorDid, targetDid));

	const canManageRoles = (actorDid: string, targetDid?: string) =>
		hasPermission(actorDid, ROLE_MANAGE) &&
		(targetDid === undefined || outranks(actorDid, targetDid));

	const getRoleManageCeiling = (did: string): number => {
		const c = community();
		if (!c) return Number.NEGATIVE_INFINITY;
		const member = c.members.find((m) => m.did === did);
		return getPermissionCeiling(
			c.roles,
			member?.roles ?? [],
			ROLE_MANAGE,
			isOwner(did),
		);
	};

	const canManageRole = (did: string, role: Role): boolean =>
		hasPermission(did, ROLE_MANAGE) &&
		isRoleBelowCeiling(getRoleManageCeiling(did), role);

	const canApplyLabel = (did: string) => hasPermission(did, LABEL_APPLY);

	const canViewModerationLog = (did: string) =>
		hasPermission(did, MODERATION_VIEW_LOG);

	const canCreateInvitation = (did: string) =>
		hasPermission(did, INVITATION_CREATE);
	const canDeleteInvitation = (did: string) =>
		hasPermission(did, INVITATION_DELETE);

	const canModerateVoice = (actorDid: string, targetDid?: string) =>
		hasPermission(actorDid, VOICE_MODERATE) &&
		(targetDid === undefined || outranks(actorDid, targetDid));

	const canMentionRoles = (did: string) => hasPermission(did, MENTION_ROLES);

	return {
		isAdmin,
		canManage,
		outranks,
		canManageCommunity,
		canDeleteCommunity,
		canManageApprovals,
		canCreateCategory,
		canUpdateCategory,
		canDeleteCategory,
		canCreateChannel,
		canUpdateChannel,
		canDeleteChannel,
		canKickMember,
		canBanMember,
		canUnbanMember,
		canManageRoles,
		getRoleManageCeiling,
		canManageRole,
		canApplyLabel,
		canViewModerationLog,
		canCreateInvitation,
		canDeleteInvitation,
		canModerateVoice,
		canMentionRoles,
	};
};

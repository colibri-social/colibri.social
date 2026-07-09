import {
	type Accessor,
	createContext,
	createEffect,
	createMemo,
	createResource,
	Match,
	on,
	onCleanup,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { namespace } from "../atproto/cache/keys";
import {
	cacheEnabled,
	readCommunity,
	writeCommunity,
} from "../atproto/cache/store";
import { urlSegmentToUri } from "../atproto/community-uri-to-url-compatible";
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
	INVITATION_CREATE,
	INVITATION_DELETE,
	isRoleBelowCeiling,
	MEMBER_BAN,
	MEMBER_KICK,
	MEMBER_UNBAN,
	MESSAGE_HIDE,
	ROLE_MANAGE,
} from "../atproto/permissions";
import type {
	CommunityData,
	Community as CommunityResponse,
} from "../atproto/xrpc/social/colibri/community/getData";
import type { Applicant } from "../atproto/xrpc/social/colibri/community/listApplications";
import type { Category } from "../atproto/xrpc/social/colibri/community/listCategories";
import type { Channel } from "../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../atproto/xrpc/social/colibri/community/listRoles";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { getAppViewDid } from "../utils/appview";
import { AtURI } from "../utils/at-uri";
import { getCommunityParam } from "../utils/get-param";
import { markBoot } from "../utils/perf";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";
import { useVoiceChatContext } from "./VoiceChat";

type CommunityContextData = CommunityResponse & {
	assignableRoles: Array<Role>;
	applications: Array<Applicant>;
	dismissedApplications: Array<Applicant>;
	ownerDid: Accessor<string>;
	utils: {
		getRolesForUser: (did: string) => Array<Role>;
		setRolesForUser: (did: string, roles: Array<string>) => void;
		patchChannel: (uri: string, patch: Partial<Channel>) => void;
		patchCategory: (uri: string, patch: Partial<Category>) => void;
		patchCommunity: (patch: Partial<CommunityData>) => void;
		patchMember: (did: string, patch: Partial<Member["data"]>) => void;
		refetch: () => void;
		refetchApplications: () => void;
	};
};

export const CommunityContext = createContext<Accessor<CommunityContextData>>();

export const CommunityContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const [, { seedPresence }] = useVoiceChatContext();
	const communityUri = createMemo(() => urlSegmentToUri(getCommunityParam()));

	// Latest desired role set per member while an optimistic change is syncing.
	// Lets the `roles_updated` handler ignore stale/reordered echoes that would
	// roll back a change the user just made; cleared whenever we (re)load
	// authoritative data. Not reactive — only touched imperatively.
	const pendingRoleIntents = new Map<string, Array<string>>();

	const [community, { mutate, refetch }] = createResource(
		communityUri,
		async (uri) => {
			pendingRoleIntents.clear();
			return await user.xrpc.social.colibri.community.getData(uri);
		},
	);

	createEffect(() => {
		if (!community.loading && community.latest) markBoot("community:ready");
	});

	let seededUri: string | null = null;
	createEffect(() => {
		const uri = communityUri();
		const data = community.latest;

		if (!uri || !data || community.loading || seededUri === uri) return;

		seededUri = uri;
		seedPresence(data.members);
	});

	const ns = () => namespace(getAppViewDid(), user.did);

	createEffect(
		on(communityUri, async (uri) => {
			if (!cacheEnabled() || !uri) return;
			const cached = await readCommunity(ns(), uri);
			if (cached && communityUri() === uri && community.loading) {
				mutate(cached);
			}
		}),
	);

	let cacheWriteTimer: ReturnType<typeof setTimeout> | undefined;
	createEffect(() => {
		const data = community.latest;
		const uri = communityUri();
		if (!cacheEnabled() || community.loading || !data || !uri) return;
		if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
		cacheWriteTimer = setTimeout(() => {
			void writeCommunity(ns(), uri, data);
		}, 500);
	});
	onCleanup(() => {
		if (cacheWriteTimer) clearTimeout(cacheWriteTimer);
	});

	// Pending join applications (active + moderator-dismissed)
	const [
		applications,
		{ mutate: mutateApplications, refetch: refetchApplications },
	] = createResource(
		() =>
			community.latest?.community.requiresApprovalToJoin
				? communityUri()
				: undefined,
		async (uri) => {
			const member = community.latest?.members.find((x) => x.did === user.did);

			if (!member) {
				return {
					applications: [],
					dismissed: [],
				};
			}

			const canManageApprovals = (community.latest?.roles ?? []).some(
				(x) =>
					x.permissions.includes("approval.manage") &&
					member.roles.some((y) => y === x.uri),
			);

			if (!canManageApprovals) {
				return {
					applications: [],
					dismissed: [],
				};
			}

			const res =
				await user.xrpc.social.colibri.community.listApplications(uri);
			return {
				applications: res?.applications ?? [],
				dismissed: res?.dismissedApplications ?? [],
			};
		},
		{ initialValue: { applications: [], dismissed: [] } },
	);

	// Handle updates for community data, members, categories, and channels
	// via the AppView WebSocket event stream.
	const cleanup = socket.onEvent((event) => {
		const prev = community.latest;
		if (!prev) return;

		if (event.type === "user_event" && event.data) {
			const { did, profile, status } = event.data;
			mutate({
				...prev,
				members: prev.members.map((m) =>
					m.did === did
						? {
								...m,
								handle: profile.handle ?? m.handle,
								data: {
									...m.data,
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
							}
						: m,
				),
			});
		} else if (event.type === "member_event" && event.data) {
			const { data } = event;
			// Filter: only act on events for the community we're currently viewing.
			if (data.community !== communityUri()) return;

			if (data.event === "join") {
				const queues = applications.latest ?? {
					applications: [],
					dismissed: [],
				};
				const matches = (a: Applicant) =>
					a.membership === data.membership || a.did === data.member.did;
				if (
					queues.applications.some(matches) ||
					queues.dismissed.some(matches)
				) {
					mutateApplications({
						applications: queues.applications.filter((a) => !matches(a)),
						dismissed: queues.dismissed.filter((a) => !matches(a)),
					});
				}

				// Append the new member if not already present (idempotent).
				if (prev.members.some((m) => m.did === data.member.did)) return;
				mutate({ ...prev, members: [...prev.members, data.member] });
			} else if (data.event === "roles_updated") {
				const did = data.member.did;
				const existing = prev.members.find((m) => m.did === did);

				// Protected roles (e.g. the owner/admin marker) are managed
				// separately and never appear in the assignable-role toggle flow or
				// this event's payload. Carry over any the member already holds, so
				// removing an assignable role from the owner doesn't strip their
				// admin rights (and the channel/category edit UI) until a reload.
				const protectedUris = new Set(
					prev.roles.filter((r) => r.protected).map((r) => r.uri),
				);
				const keptProtected =
					existing?.roles.filter((uri) => protectedUris.has(uri)) ?? [];

				// If we have an in-flight optimistic change for this member, only
				// accept the event once it confirms that intent — otherwise a stale
				// or reordered echo (e.g. of a role we just removed and re-added)
				// would roll the change back.
				const intent = pendingRoleIntents.get(did);
				if (intent) {
					const intentAssignable = new Set(
						intent.filter((uri) => !protectedUris.has(uri)),
					);
					const incomingAssignable = data.member.roles.filter(
						(uri) => !protectedUris.has(uri),
					);
					const confirmsIntent =
						intentAssignable.size === incomingAssignable.length &&
						incomingAssignable.every((uri) => intentAssignable.has(uri));
					if (!confirmsIntent) return;
					pendingRoleIntents.delete(did);
				}

				const mergedRoles = Array.from(
					new Set([...data.member.roles, ...keptProtected]),
				);

				mutate({
					...prev,
					members: prev.members.map((m) =>
						m.did === did
							? {
									...m,
									roles: mergedRoles,
									data: { ...m.data, ...data.member.data },
								}
							: m,
					),
				});
			} else if (data.event === "leave") {
				// Self-removal arrives as `community_event { delete }`, so a leave
				// event is always about another member.
				mutate({
					...prev,
					members: prev.members.filter((m) => m.did !== data.memberDid),
				});
			}
		} else if (event.type === "application_event" && event.data) {
			const { data } = event;
			if (data.community !== communityUri()) return;

			const queues = applications.latest ?? {
				applications: [],
				dismissed: [],
			};

			if (data.event === "create") {
				// A new (or kick-resurfaced) pending application.
				if (queues.applications.some((a) => a.membership === data.membership)) {
					return;
				}
				mutateApplications({
					applications: [
						...queues.applications,
						{
							did: data.did,
							handle: data.handle,
							membership: data.membership,
							createdAt: data.createdAt,
							data: data.data,
						},
					],
					dismissed: queues.dismissed.filter(
						(a) => a.membership !== data.membership,
					),
				});
			} else if (data.event === "dismiss") {
				const existing = queues.applications.find(
					(a) => a.membership === data.membership,
				);
				if (!existing) {
					if (!queues.dismissed.some((a) => a.membership === data.membership)) {
						refetchApplications();
					}
					return;
				}
				mutateApplications({
					applications: queues.applications.filter(
						(a) => a.membership !== data.membership,
					),
					dismissed: [...queues.dismissed, existing],
				});
			} else if (data.event === "undismiss") {
				const existing = queues.dismissed.find(
					(a) => a.membership === data.membership,
				);
				if (!existing) {
					if (
						!queues.applications.some((a) => a.membership === data.membership)
					) {
						refetchApplications();
					}
					return;
				}
				mutateApplications({
					applications: [...queues.applications, existing],
					dismissed: queues.dismissed.filter(
						(a) => a.membership !== data.membership,
					),
				});
			} else if (data.event === "resolve") {
				mutateApplications({
					applications: queues.applications.filter(
						(a) => a.membership !== data.membership,
					),
					dismissed: queues.dismissed.filter(
						(a) => a.membership !== data.membership,
					),
				});
			}
		} else if (event.type === "community_event" && event.data) {
			const { data } = event;
			if (data.uri !== communityUri()) return;

			if (data.event === "delete") {
				// Community was deleted (or we were removed). AppLayout owns the
				// response — it drops the community from the sidebar and navigates
				// us home — so there's nothing to patch into the active resource.
				return;
			}
			// Upsert: patch whatever fields are provided.
			mutate({
				...prev,
				community: {
					...prev.community,
					...(data.name !== undefined && { name: data.name }),
					...(data.description !== undefined && {
						description: data.description,
					}),
					...(data.picture !== undefined && { picture: data.picture }),
					...(data.categoryOrder !== undefined && {
						categoryOrder: data.categoryOrder,
					}),
					...(data.requiresApprovalToJoin !== undefined && {
						requiresApprovalToJoin: data.requiresApprovalToJoin,
					}),
				},
			});
		} else if (event.type === "category_event" && event.data) {
			const { data } = event;
			if (data.community && data.community !== communityUri()) return;

			if (data.event === "delete") {
				mutate({
					...prev,
					categories: prev.categories.filter((c) => c.uri !== data.uri),
				});
				return;
			}
			// Upsert: add or update.
			const existing = prev.categories.find((c) => c.uri === data.uri);
			if (existing) {
				mutate({
					...prev,
					categories: prev.categories.map((c) =>
						c.uri === data.uri
							? {
									...c,
									...(data.name && { name: data.name }),
									...(data.channelOrder && { channelOrder: data.channelOrder }),
								}
							: c,
					),
				});
			} else {
				mutate({
					...prev,
					categories: [
						...prev.categories,
						{
							uri: data.uri,
							name: data.name ?? "",
							channelOrder: data.channelOrder ?? [],
						},
					],
				});
			}
		} else if (event.type === "channel_event" && event.data) {
			const { data } = event;
			if (data.community && data.community !== communityUri()) return;

			if (data.event === "delete") {
				mutate({
					...prev,
					channels: prev.channels.filter((c) => c.uri !== data.uri),
				});
				return;
			}
			// Upsert: update if exists, or refetch if new (category is unknown from event).
			const existing = prev.channels.find((c) => c.uri === data.uri);
			if (existing) {
				mutate({
					...prev,
					channels: prev.channels.map((c) =>
						c.uri === data.uri
							? {
									...c,
									...(data.name !== undefined && { name: data.name }),
									...(data.description !== undefined && {
										description: data.description,
									}),
									...(data.type !== undefined && { type: data.type }),
									...(data.ownerOnly !== undefined && {
										ownerOnly: data.ownerOnly,
									}),
									...(data.allowedRoles !== undefined && {
										allowedRoles: data.allowedRoles,
									}),
									...(data.allowedMembers !== undefined && {
										allowedMembers: data.allowedMembers,
									}),
								}
							: c,
					),
				});
			} else {
				// New channel: refetch to get its category assignment.
				refetch();
			}
		} else if (event.type === "role_event" && event.data) {
			const { data } = event;

			if (data.event === "delete") {
				// Remove the role and scrub it from every member that held it.
				mutate({
					...prev,
					roles: prev.roles.filter((r) => r.uri !== data.uri),
					members: prev.members.map((m) =>
						m.roles.includes(data.uri)
							? { ...m, roles: m.roles.filter((u) => u !== data.uri) }
							: m,
					),
				});
				return;
			}

			// upsert (carries `community`) — only touch the active community.
			if (data.community !== communityUri()) return;

			const existing = prev.roles.find((r) => r.uri === data.uri);
			if (existing) {
				mutate({
					...prev,
					roles: prev.roles.map((r) =>
						r.uri === data.uri
							? {
									...r,
									...(data.name !== undefined && { name: data.name }),
									...(data.color !== undefined && { color: data.color }),
									...(data.permissions !== undefined && {
										permissions: data.permissions,
									}),
									...(data.position !== undefined && {
										position: data.position,
									}),
									...(data.hoisted !== undefined && { hoisted: data.hoisted }),
									...(data.mentionable !== undefined && {
										mentionable: data.mentionable,
									}),
								}
							: r,
					),
				});
			} else {
				// New role — fill required Role fields with sensible defaults.
				mutate({
					...prev,
					roles: [
						...prev.roles,
						{
							uri: data.uri,
							name: data.name ?? "",
							color: data.color,
							permissions: data.permissions ?? [],
							position: data.position ?? 0,
							hoisted: data.hoisted,
							mentionable: data.mentionable,
							channelOverrides: [],
						},
					],
				});
			}
		}
	});

	onCleanup(cleanup);

	// The single source of truth for "real", user-facing roles. Protected roles
	// exist only as permission-check markers (there should be exactly one) and
	// must never be shown or assigned, so they're excluded here and everything
	// that lists/displays roles reads from this instead of filtering ad-hoc.
	const assignableRoles = createMemo(() =>
		(community.latest?.roles ?? []).filter((role) => !role.protected),
	);

	const getRolesForUser = (did: string) => {
		const member = community.latest?.members.find((x) => x.did === did);
		if (!member) return [];

		return assignableRoles()
			.filter((role) => member.roles.includes(role.uri))
			.sort((a, b) => b.position - a.position);
	};

	// Optimistically overwrite a member's roles in the shared context so every
	// consumer (name colours, profile popover, member grouping) updates
	// immediately, without waiting for the server's `roles_updated` event.
	const setRolesForUser = (did: string, roles: Array<string>) => {
		const prev = community.latest;
		if (!prev) return;
		// Record the desired set so the `roles_updated` handler can tell our own
		// confirming event apart from stale echoes.
		pendingRoleIntents.set(did, roles);
		mutate({
			...prev,
			members: prev.members.map((m) => (m.did === did ? { ...m, roles } : m)),
		});
	};

	const patchChannel = (uri: string, patch: Partial<Channel>) => {
		const prev = community.latest;
		if (!prev || !prev.channels.some((c) => c.uri === uri)) return;
		mutate({
			...prev,
			channels: prev.channels.map((c) =>
				c.uri === uri ? { ...c, ...patch } : c,
			),
		});
	};

	const patchCategory = (uri: string, patch: Partial<Category>) => {
		const prev = community.latest;
		if (!prev || !prev.categories.some((c) => c.uri === uri)) return;
		mutate({
			...prev,
			categories: prev.categories.map((c) =>
				c.uri === uri ? { ...c, ...patch } : c,
			),
		});
	};

	const patchCommunity = (patch: Partial<CommunityData>) => {
		const prev = community.latest;
		if (!prev) return;
		mutate({ ...prev, community: { ...prev.community, ...patch } });
	};

	// Optimistically patch a member's profile/presence data
	const patchMember = (did: string, patch: Partial<Member["data"]>) => {
		const prev = community.latest;
		if (!prev || !prev.members.some((m) => m.did === did)) return;
		mutate({
			...prev,
			members: prev.members.map((m) =>
				m.did === did ? { ...m, data: { ...m.data, ...patch } } : m,
			),
		});
	};

	const ownerRole = () =>
		(community.latest?.roles ?? []).find((x) => x.protected)!;

	const value: Accessor<CommunityContextData> = () => ({
		...(community.latest as CommunityResponse),
		assignableRoles: assignableRoles(),
		applications: applications.latest?.applications ?? [],
		dismissedApplications: applications.latest?.dismissed ?? [],
		ownerDid: () =>
			community.latest!.members.find((x) =>
				x.roles.some((y) => y === ownerRole().uri || ""),
			)!.did,
		utils: {
			getRolesForUser,
			setRolesForUser,
			patchChannel,
			patchCategory,
			patchCommunity,
			patchMember,
			refetch: () => void refetch(),
			refetchApplications: () => void refetchApplications(),
		},
	});

	return (
		<Switch>
			<Match when={community.error}>
				<span>{`${community.error}`}</span>
			</Match>
			<Match when={community.loading && !community.latest}>
				<AppLoadingScreen message="Fetching community details..." />
			</Match>
			<Match when={community.latest}>
				<CommunityContext.Provider value={value}>
					{props.children}
				</CommunityContext.Provider>
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

/**
 * Returns permission-checking helpers scoped to the current community.
 *
 * `isAdmin(did)` — true if the DID is the community owner or holds a
 *   protected (admin-level) role.
 * `canManage(did)` — alias for `isAdmin`.
 * `outranks(actorDid, targetDid)` — true when the actor's highest role
 *   position is strictly greater than the target's.
 *
 * Member-targeting helpers (`canKickMember`, `canBanMember`, `canUnbanMember`,
 * `canManageRoles`) accept an optional `targetDid`. When provided, the actor
 * must also outrank the target for the check to pass.
 *
 * All other helpers check whether the member holds a role that carries the
 * specific AppView permission string, or is the community owner (who
 * implicitly has every permission and the highest possible rank).
 */
export const usePermissions = () => {
	const community = useCommunityContext();

	const isOwner = (did: string): boolean => {
		const c = community();
		if (!c) return false;
		return did === AtURI.parseAtURI(c.community.uri).did;
	};

	// Returns the highest role position held by a member.
	// The community owner is treated as Infinity so they always outrank everyone.
	const getRank = (did: string): number => {
		const c = community();
		if (!c) return -Infinity;
		if (isOwner(did)) return Infinity;
		const member = c.members.find((m) => m.did === did);
		if (!member) return -Infinity;
		return member.roles.reduce((max, roleUri) => {
			const pos = c.roles.find((r) => r.uri === roleUri)?.position ?? -Infinity;
			return pos > max ? pos : max;
		}, -Infinity);
	};

	// True when the actor's highest role position is strictly greater than the target's.
	const outranks = (actorDid: string, targetDid: string): boolean =>
		getRank(actorDid) > getRank(targetDid);

	const hasPermission = (did: string, permission: string): boolean => {
		const c = community();
		if (!c) return false;
		if (isOwner(did)) return true;
		const member = c.members.find((m) => m.did === did);
		if (!member) return false;
		return member.roles.some((roleUri) =>
			c.roles.find((r) => r.uri === roleUri)?.permissions.includes(permission),
		);
	};

	const isAdmin = (did: string): boolean => {
		const c = community();
		if (!c) return false;
		if (isOwner(did)) return true;
		const member = c.members.find((m) => m.did === did);
		if (!member) return false;
		return member.roles.some(
			(roleUri) => c.roles.find((r) => r.uri === roleUri)?.protected,
		);
	};

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

	// Highest position among the roles `did` holds that themselves grant
	// `role.manage` — the ceiling below which they're allowed to manage
	// other roles (assign/unassign/edit/delete). Distinct from `getRank`,
	// which considers the member's overall highest role regardless of
	// whether it carries `role.manage`.
	const getRoleManageCeiling = (did: string): number => {
		const c = community();
		if (!c) return -Infinity;
		const member = c.members.find((m) => m.did === did);
		return getPermissionCeiling(
			c.roles,
			member?.roles ?? [],
			ROLE_MANAGE,
			isOwner(did),
		);
	};

	// Whether `did` can manage (assign/unassign/edit/delete) the given role.
	const canManageRole = (did: string, role: Role): boolean =>
		hasPermission(did, ROLE_MANAGE) &&
		isRoleBelowCeiling(getRoleManageCeiling(did), role);

	const canHideMessage = (did: string) => hasPermission(did, MESSAGE_HIDE);

	const canCreateInvitation = (did: string) =>
		hasPermission(did, INVITATION_CREATE);
	const canDeleteInvitation = (did: string) =>
		hasPermission(did, INVITATION_DELETE);

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
		canHideMessage,
		canCreateInvitation,
		canDeleteInvitation,
	};
};

import { useNavigate } from "@solidjs/router";
import {
	type Accessor,
	createContext,
	createMemo,
	createResource,
	Match,
	onCleanup,
	type ParentComponent,
	Switch,
	useContext,
} from "solid-js";
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
	INVITATION_CREATE,
	INVITATION_DELETE,
	MEMBER_BAN,
	MEMBER_KICK,
	MEMBER_UNBAN,
	MESSAGE_HIDE,
	ROLE_MANAGE,
} from "../atproto/permissions";
import type { Community as CommunityResponse } from "../atproto/xrpc/social/colibri/community/getData";
import type { Role } from "../atproto/xrpc/social/colibri/community/listRoles";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AtURI } from "../utils/at-uri";
import { getCommunityParam } from "../utils/get-param";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";

type CommunityContextData = CommunityResponse & {
	/** Non-protected roles — the ones safe to show and assign. */
	assignableRoles: Array<Role>;
	utils: {
		getRolesForUser: (did: string) => Array<Role>;
		setRolesForUser: (did: string, roles: Array<string>) => void;
		refetch: () => void;
	};
};

export const CommunityContext = createContext<Accessor<CommunityContextData>>();

export const CommunityContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const navigate = useNavigate();
	const communityUri = createMemo(() => urlSegmentToUri(getCommunityParam()));

	const [community, { mutate, refetch }] = createResource(
		communityUri,
		async (uri) => {
			return await user.xrpc.social.colibri.community.getData(uri);
		},
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
				// Append the new member if not already present (idempotent).
				if (prev.members.some((m) => m.did === data.member.did)) return;
				mutate({ ...prev, members: [...prev.members, data.member] });
			} else if (data.event === "roles_updated") {
				// A moderator changed this member's roles — patch in place.
				mutate({
					...prev,
					members: prev.members.map((m) =>
						m.did === data.member.did
							? {
									...m,
									roles: data.member.roles,
									data: { ...m.data, ...data.member.data },
								}
							: m,
					),
				});
			} else if (data.event === "leave") {
				if (data.membership) {
					const leavingDid = AtURI.parseAtURI(data.membership).did;
					if (leavingDid === user.did) {
						navigate("/app");
						return;
					}
					mutate({
						...prev,
						members: prev.members.filter((m) => m.did !== leavingDid),
					});
				} else {
					// No membership URI to identify the leaver — refetch the roster.
					refetch();
				}
			}
		} else if (event.type === "community_event" && event.data) {
			const { data } = event;
			if (data.uri !== communityUri()) return;

			if (data.event === "delete") {
				// Community was deleted; the AppLayout will navigate away once the
				// community is gone from the user's list (on next refetch).
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
									...(data.name && { name: data.name }),
									...(data.type && { type: data.type }),
								}
							: c,
					),
				});
			} else {
				// New channel: refetch to get its category assignment.
				refetch();
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
		mutate({
			...prev,
			members: prev.members.map((m) => (m.did === did ? { ...m, roles } : m)),
		});
	};

	const value: Accessor<CommunityContextData> = () => ({
		...(community.latest as CommunityResponse),
		assignableRoles: assignableRoles(),
		utils: {
			getRolesForUser,
			setRolesForUser,
			refetch: () => void refetch(),
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

	const canHideMessage = (did: string) => hasPermission(did, MESSAGE_HIDE);

	const canCreateInvitation = (did: string) =>
		hasPermission(did, INVITATION_CREATE);
	const canDeleteInvitation = (did: string) =>
		hasPermission(did, INVITATION_DELETE);

	return {
		isAdmin,
		canManage,
		outranks,
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
		canHideMessage,
		canCreateInvitation,
		canDeleteInvitation,
	};
};

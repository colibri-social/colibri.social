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
import type { Community as CommunityResponse } from "../atproto/xrpc/social/colibri/community/getData";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AtURI } from "../utils/at-uri";
import { getCommunityParam } from "../utils/get-param";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";

export const CommunityContext = createContext<Accessor<CommunityResponse>>();

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

	const value: Accessor<CommunityResponse> = () =>
		community.latest as CommunityResponse;

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

export const useCommunityContext = (): Accessor<CommunityResponse> => {
	const ctx = useContext(CommunityContext);

	if (!ctx) {
		throw new Error("Unable to get community context.");
	}

	return ctx;
};

/**
 * Returns `isAdmin` and `canManage` helpers scoped to the current community.
 *
 * `isAdmin(did)` — true if the DID is the community owner or holds a
 *   protected (admin-level) role.
 * `canManage(did)` — same as `isAdmin` until explicit per-permission strings
 *   are defined in the AppView catalog.
 */
export const usePermissions = () => {
	const community = useCommunityContext();

	const isAdmin = (did: string): boolean => {
		const c = community();
		if (!c) return false;
		const ownerDid = AtURI.parseAtURI(c.community.uri).did;
		if (did === ownerDid) return true;
		const member = c.members.find((m) => m.did === did);
		if (!member) return false;
		return member.roles.some(
			(roleUri) => c.roles.find((r) => r.uri === roleUri)?.protected,
		);
	};

	const canManage = (did: string): boolean => isAdmin(did);

	return { isAdmin, canManage };
};

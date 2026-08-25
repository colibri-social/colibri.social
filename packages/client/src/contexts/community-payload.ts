import { activityOf } from "../atproto/activity";
import type {
	Activity,
	ApplicationView,
	CategoryView,
	ChannelView,
	CommunityView,
	MemberView,
	Presence,
	ProfileView,
	RoleView,
} from "../atproto/views";

export type OnlineState = "online" | "away" | "dnd" | "offline";

export type MemberStatus = { text: string; emoji?: string };

export type MemberData = {
	displayName: string;
	avatar?: string;
	banner?: string;
	description?: string;
	isBot: boolean;
	syncBluesky: boolean;
	onlineState: OnlineState;
	status?: MemberStatus;
	activity?: Activity;
	theme?: ProfileView["theme"];
	preferredBadge?: string;
};

export type Member = {
	did: string;
	handle: string;
	roles: Array<string>;
	joinedAt: string;
	nickname?: string;
	actor: ProfileView;
	data: MemberData;
};

export type Applicant = {
	did: string;
	handle: string;
	createdAt: string;
	dismissed: boolean;
	actor: ProfileView;
	data: Pick<
		MemberData,
		| "displayName"
		| "avatar"
		| "banner"
		| "description"
		| "isBot"
		| "theme"
		| "preferredBadge"
	>;
};

export type Category = CategoryView;
export type Channel = ChannelView;
export type Role = RoleView;

export type CommunityPayload = {
	community: CommunityView;
	categories: Array<Category>;
	channels: Array<Channel>;
	roles: Array<Role>;
	members: Array<Member>;
};

const LIVE_ONLINE_STATES = new Set(["online", "away", "dnd"]);

export const normalizeOnlineState = (state: string | undefined): OnlineState =>
	state !== undefined && LIVE_ONLINE_STATES.has(state)
		? (state as OnlineState)
		: "offline";

const onlineStateOf = (actor: ProfileView): OnlineState =>
	normalizeOnlineState(actor.presence?.onlineState);

const memberDataOf = (actor: ProfileView): MemberData => ({
	displayName: actor.displayName,
	avatar: actor.avatar,
	banner: actor.banner,
	description: actor.description,
	isBot: actor.isBot,
	syncBluesky: actor.syncBluesky,
	onlineState: onlineStateOf(actor),
	status: actor.presence?.status,
	activity: activityOf(actor.presence),
	theme: actor.theme,
	preferredBadge: actor.preferredBadge,
});

export const toMember = (view: MemberView): Member => ({
	did: view.actor.did,
	handle: view.actor.handle,
	roles: view.roles,
	joinedAt: view.joinedAt,
	nickname: view.nickname,
	actor: view.actor,
	data: memberDataOf(view.actor),
});

export const withMemberPresence = (
	member: Member,
	presence: Presence,
): Member => ({
	...member,
	actor: { ...member.actor, presence },
	data: {
		...member.data,
		onlineState: normalizeOnlineState(presence.onlineState),
		status: presence.status,
		activity: presence.activity,
	},
});

export const patchMemberData = (
	member: Member,
	patch: Partial<MemberData>,
): Member => {
	const patched = { ...member, data: { ...member.data, ...patch } };
	if (
		!("onlineState" in patch) &&
		!("status" in patch) &&
		!("activity" in patch)
	)
		return patched;

	return withMemberPresence(patched, {
		...member.actor.presence,
		onlineState: patched.data.onlineState,
		status: patched.data.status,
		activity: patched.data.activity,
	});
};

export const toApplicant = (view: ApplicationView): Applicant => {
	const {
		onlineState: _onlineState,
		syncBluesky: _syncBluesky,
		status: _status,
		activity: _activity,
		...data
	} = memberDataOf(view.actor);
	return {
		did: view.actor.did,
		handle: view.actor.handle,
		createdAt: view.createdAt,
		dismissed: view.dismissed,
		actor: view.actor,
		data,
	};
};

export const emptyCommunityPayload = (): CommunityPayload => ({
	community: {
		did: "",
		handle: "",
		managingApp: "",
		name: "",
		description: "",
		requiresApprovalToJoin: false,
		linkEmbeds: true,
		viewer: { isMember: false },
	} as unknown as CommunityView,
	categories: [],
	channels: [],
	roles: [],
	members: [],
});

export const isCommunityPayload = (
	value: CommunityPayload | undefined,
): value is CommunityPayload =>
	value !== undefined &&
	typeof value.community === "object" &&
	value.community !== null &&
	Array.isArray(value.members) &&
	Array.isArray(value.roles) &&
	Array.isArray(value.channels) &&
	Array.isArray(value.categories);

export const payloadForCommunity = (
	payload: CommunityPayload | undefined,
	did: string,
): CommunityPayload | undefined =>
	did !== "" && payload !== undefined && payload.community.did === did
		? payload
		: undefined;

export const sameRoles = (
	left: ReadonlyArray<string> | undefined,
	right: ReadonlyArray<string> | undefined,
): boolean => {
	if (left === undefined || right === undefined) return left === right;
	if (left.length !== right.length) return false;
	const held = new Set(left);
	return right.every((rkey) => held.has(rkey));
};

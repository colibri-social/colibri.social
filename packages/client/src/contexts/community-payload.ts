import type {
	ApplicationView,
	CategoryView,
	ChannelView,
	CommunityView,
	MemberView,
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

export const toApplicant = (view: ApplicationView): Applicant => {
	const {
		onlineState: _onlineState,
		syncBluesky: _syncBluesky,
		status: _status,
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

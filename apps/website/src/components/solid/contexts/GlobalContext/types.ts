import type {
	CategoryData,
	ChannelData,
	CommunityData,
	DBMessageData,
	IndexedMessageData,
} from "@/utils/sdk";
import type { MemberData } from "../../layouts/CommunityLayout";
import type {
	MessageDeletionEvent,
	ReactionEventCallback,
	UserOnlineState,
	UserProfileUpdatedEvent,
	UserStatusChangedEvent,
	VoiceChannelUpdatedEvent,
} from "./events";

export type PendingMessageData = Omit<
	Omit<DBMessageData, "rkey">,
	"attachments"
> & {
	hash: string;
};

export type OnlineStateInfo = {
	state: UserOnlineState;
	did: string;
};

export type GlobalContextData = {
	communities: Array<CommunityData>;
	categories: Array<CategoryData>;
	addedChannels: Array<ChannelData>;
	removedChannels: Array<string>;
	removedCategories: Array<string>;
	pendingMessages: Array<PendingMessageData>;
	additionalMessages: Array<IndexedMessageData>;
	user: App.SessionData["user"];
	deletedMessages: Array<Omit<MessageDeletionEvent, "id">>;
	joinedMembers: Array<MemberData>;
	removedMembers: Array<MemberData>;
	uiStates: {
		membersListVisible: boolean;
	};
	memberProfileOverrides: Array<UserProfileUpdatedEvent>;
	memberStatusOverrides: Array<UserStatusChangedEvent>;
	userOnlineStates: Array<OnlineStateInfo>;
	knownVoiceChannelStates: Array<VoiceChannelUpdatedEvent>;
};

export type GlobalContextUtility = {
	addCommunity: (community: CommunityData) => void;
	removeCommunity: (rkey: string) => void;
	setCommunities: (communties: Array<CommunityData>) => void;
	addCategory: (category: CategoryData) => void;
	removeCategory: (rkey: string) => void;
	addChannel: (channel: ChannelData) => void;
	removeChannel: (rkey: string) => void;
	addPendingMessage: (message: PendingMessageData) => void;
	removePendingMessage: (hash: string) => void;
	addDeletedMessage: (data: Omit<MessageDeletionEvent, "id">) => void;
	addAdditionalMessage: (message: IndexedMessageData) => void;
	clearAdditionalMessages: () => void;
	sendSocketMessage: (message: Record<string, unknown>) => void;
	clearDeletedMessages: () => void;
	addReactionListener: (callback: ReactionEventCallback) => () => void;
	addJoinedMember: (data: MemberData) => void;
	addRemovedMember: (data: MemberData) => void;
	clearOptimisticMemberUpdates: () => void;
	setUserData: (data: App.SessionData["user"]) => void;
	setMemberListVisible: (
		state: boolean | ((current: boolean) => boolean),
	) => void;
	addMemberProfileOverride: (data: UserProfileUpdatedEvent) => void;
	addMemberStatusOverride: (data: UserStatusChangedEvent) => void;
	clearMemberOverrides: () => void;
	updateUserOnlineState: (state: OnlineStateInfo) => void;
	processVoiceChannelUpdate: (data: VoiceChannelUpdatedEvent) => void;
};

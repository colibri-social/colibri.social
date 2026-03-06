import type {
	CategoryData,
	ChannelData,
	CommunityData,
	DBMessageData,
	IndexedMessageData,
} from "@/utils/sdk";
import type { MessageDeletionEvent, ReactionEventCallback } from "./events";

export type PendingMessageData = Omit<DBMessageData, "rkey"> & {
	hash: string;
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
};

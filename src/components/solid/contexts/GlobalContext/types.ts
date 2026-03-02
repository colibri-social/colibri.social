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
	channels: Array<ChannelData>;
	pendingMessages: Array<PendingMessageData>;
	additionalMessages: Array<IndexedMessageData>;
	user: App.SessionData["user"];
	deletedMessages: Array<Omit<MessageDeletionEvent, "id">>;
};

export type GlobalContextUtility = {
	addCommunity: (community: CommunityData) => void;
	removeCommunity: (rkey: string) => void;
	addCategory: (category: CategoryData) => void;
	addChannel: (channel: ChannelData) => void;
	addPendingMessage: (message: PendingMessageData) => void;
	removePendingMessage: (hash: string) => void;
	addDeletedMessage: (data: Omit<MessageDeletionEvent, "id">) => void;
	addAdditionalMessage: (message: IndexedMessageData) => void;
	clearAdditionalMessages: () => void;
	sendSocketMessage: (message: Record<string, unknown>) => void;
	clearDeletedMessages: () => void;
	addReactionListener: (callback: ReactionEventCallback) => () => void;
};

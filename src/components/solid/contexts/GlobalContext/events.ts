import type { Facet } from "@/utils/atproto/rich-text";
import type { IndexedMessageData } from "@/utils/sdk";

export type AckEvent = {
	type: "ack";
	message: string;
};

export type BlobObj = {
	$type: "blob";
	ref: { $link: string };
	mimeType: string;
	size: number;
};

export type AttachmentObj = {
	blob: BlobObj;
	name?: string;
};

export type MessageEventPayload = {
	id: string;
	rkey: string;
	author_did: string;
	text: string;
	facets: Facet[];
	channel: string;
	created_at: string;
	indexed_at: string;
	display_name: string;
	avatar_url: string;
	attachments: Array<AttachmentObj>;
	edited: boolean;
};

export type MessagePostEvent = {
	type: "message";
	parent: string | null;
	parent_message: IndexedMessageData | null;
} & MessageEventPayload;

export type MessageDeletionEvent = {
	type: "message_deleted";
	id: string;
	rkey: string;
	author_did: string;
	channel: string;
};

export type ReactionData = {
	rkey: string;
	author_did: string;
	emoji: string;
	target_rkey: string;
	target_author_did: string;
	channel: string;
};

export type ReactionAddedEvent = ReactionData & {
	type: "reaction_added";
};

export type ReactionRemovedEvent = ReactionData & {
	type: "reaction_removed";
};

export type CommunityUpsertedEvent = {
	type: "community_upserted";
	community_uri: string;
	owner_did: string;
	rkey: string;
	name: string;
	description: string;
	picture: BlobObj | null;
	category_order: Array<string>;
	requires_approval_to_join: boolean;
};

export type CommunityDeletedEvent = {
	type: "community_deleted";
	community_uri: string;
	owner_did: string;
	rkey: string;
};

export type ChannelCreatedEvent = {
	type: "channel_created";
	community_uri: string;
	uri: string;
	rkey: string;
	name: string;
	channel_type: string;
	category_rkey: string;
	owner_only: boolean;
};

export type ChannelDeletedEvent = {
	type: "channel_deleted";
	community_uri: string;
	uri: string;
	rkey: string;
};

export type CategoryCreatedEvent = {
	type: "category_created";
	community_uri: string;
	uri: string;
	rkey: string;
	name: string;
	emoji: string | null;
	parent_rkey: string | null;
};

export type CategoryDeletedEvent = {
	type: "category_deleted";
	community_uri: string;
	uri: string;
	rkey: string;
};

export type MemberPendingEvent = {
	type: "member_pending";
	community_uri: string;
	member_did: string;
	membership_uri: string;
};

export type MemberJoinedEvent = {
	type: "member_joined";
	community_uri: string;
	member_did: string;
	membership_uri: string;
	display_name?: string;
	avatar_url?: string;
};

export type MemberLeftEvent = {
	type: "member_left";
	community_uri: string;
	member_did: string;
	display_name?: string;
	avatar_url?: string;
};

export type UserOnlineState = "online" | "away" | "dnd" | "offline";

export type UserStatusChangedEvent = {
	type: "user_status_changed";
	did: string;
	status: string;
	emoji?: string;
	display_name?: string;
	avatar_url?: string;
	state: UserOnlineState;
};

export type UserProfileUpdatedEvent = {
	type: "user_profile_updated";
	did: string;
	display_name?: string;
	avatar_url?: string;
	banner_url?: string;
	description?: string;
	handle?: string;
};

export type VoiceChannelUpdatedEvent = {
	type: "voice_channel_updated";
	community_uri: string;
	channel_rkey: string;
	member_dids: Array<string>;
};

export type AppviewSubscriptionData =
	| AckEvent
	| MessagePostEvent
	| MessageDeletionEvent
	| ReactionAddedEvent
	| ReactionRemovedEvent
	| CommunityUpsertedEvent
	| CommunityDeletedEvent
	| ChannelCreatedEvent
	| ChannelDeletedEvent
	| CategoryCreatedEvent
	| CategoryDeletedEvent
	| MemberPendingEvent
	| MemberJoinedEvent
	| MemberLeftEvent
	| UserStatusChangedEvent
	| UserProfileUpdatedEvent
	| VoiceChannelUpdatedEvent;

export type ReactionEventCallback = (
	data: ReactionAddedEvent | ReactionRemovedEvent,
) => void;

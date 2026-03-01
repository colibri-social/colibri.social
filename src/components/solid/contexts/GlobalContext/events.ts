import type { IndexedMessageData } from "@/utils/sdk";

// ── Shared ─────────────────────────────────────────────────────

export type AckEvent = {
	type: "ack";
	message: string;
};

// ── Message subscription events ────────────────────────────────

export type MessageEventPayload = {
	id: string;
	rkey: string;
	author_did: string;
	text: string;
	channel: string;
	created_at: string;
	indexed_at: string;
	display_name: string;
	avatar_url: string;
};

export type MessagePostEvent = {
	type: "message";
	parent: IndexedMessageData | null;
} & MessageEventPayload;

export type MessageDeletionEvent = {
	type: "message_deleted";
	id: string;
	rkey: string;
	author_did: string;
	channel: string;
};

// ── Reaction events ────────────────────────────────────────────

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

// ── Community subscription events ──────────────────────────────

export type CommunityUpsertedEvent = {
	type: "community_upserted";
	community_uri: string;
	owner_did: string;
	rkey: string;
	name: string;
	description: string;
	image: Record<string, unknown> | null;
	category_order: Array<string>;
};

export type CommunityDeletedEvent = {
	type: "community_deleted";
	community_uri: string;
	owner_did: string;
	rkey: string;
};

// ── Channel events ─────────────────────────────────────────────

export type ChannelCreatedEvent = {
	type: "channel_created";
	community_uri: string;
	uri: string;
	rkey: string;
	name: string;
	channel_type: string;
	category_rkey: string;
};

export type ChannelDeletedEvent = {
	type: "channel_deleted";
	community_uri: string;
	uri: string;
	rkey: string;
};

// ── Category events ────────────────────────────────────────────

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

// ── Membership events ──────────────────────────────────────────

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
};

export type MemberLeftEvent = {
	type: "member_left";
	community_uri: string;
	member_did: string;
};

// ── Union of all possible subscription events ──────────────────

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
	| MemberLeftEvent;

// ── Callback types ─────────────────────────────────────────────

export type ReactionEventCallback = (
	data: ReactionAddedEvent | ReactionRemovedEvent,
) => void;

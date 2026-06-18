import type { JsonBlobRef } from "@atproto/lexicon";
import type { AT_URI } from "./atproto.js";
import type { ColibriRichTextFacet } from "./facets.js";
import type { OnlineState } from "./shared.js";
import type { ActorData } from "./xrpc/social.colibri/actor/getData.js";

interface EventBase<T extends string, D = undefined> {
	type: T;
	data?: D;
}

export type AckEvent = EventBase<"ack">;

export type Colibri_CommunityEvent = EventBase<
	"community_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.community">;
			name?: string;
			description?: string;
			picture?: JsonBlobRef;
			categoryOrder?: Array<string>;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.community">;
	  }
>;

/**
 * Shape of the member object included in member_event join payloads.
 * Mirrors the `Member` type from `listMembers.ts` (same fields, kept
 * local to avoid a cross-package import cycle).
 */
export type Colibri_MemberEventMember = {
	did: string;
	handle: string;
	roles: Array<string>;
	joinedAt?: string;
	nickname?: string;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		onlineState: OnlineState;
		status?: { emoji?: string; text: string };
	};
};

export type Colibri_MemberEvent = EventBase<
	"member_event",
	/**
	 * Broadcast to every client; scope by `community`, not by DID.
	 * - `join`: a member record was created (auto-admit or approveMembership).
	 *   Carries the full `member`. When `member.did === currentUserDid` the
	 *   local user was just admitted — replaces the old community_event upsert.
	 * - `roles_updated`: a moderator changed a member's roles. Carries the
	 *   full `member` with the new `roles` array. No `membership` field.
	 * - `leave`: a member record was deleted (kick, ban, self-leave). The
	 *   removed user receives a `community_event { delete }` instead. All
	 *   other community members receive this event so they can update their
	 *   member list. `memberDid` identifies who left.
	 */
	| {
			event: "join";
			community: AT_URI<"social.colibri.community">;
			membership?: AT_URI<"social.colibri.membership">;
			member: Colibri_MemberEventMember;
	  }
	| {
			event: "roles_updated";
			community: AT_URI<"social.colibri.community">;
			member: Colibri_MemberEventMember;
	  }
	| {
			event: "leave";
			community: AT_URI<"social.colibri.community">;
			memberDid: string;
	  }
>;

export type Colibri_CategoryEvent = EventBase<
	"category_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.category">;
			community?: AT_URI<"social.colibri.community">;
			name?: string;
			channelOrder?: Array<string>;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.category">;
			community?: AT_URI<"social.colibri.community">;
	  }
>;

export type Colibri_ChannelEvent = EventBase<
	"channel_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.channel">;
			community?: AT_URI<"social.colibri.community">;
			name?: string;
			description?: string;
			type?: string;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.channel">;
			community?: AT_URI<"social.colibri.community">;
	  }
>;

export type Colibri_RoleEvent = EventBase<
	"role_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.role">;
			community: AT_URI<"social.colibri.community">;
			name?: string;
			color?: string;
			permissions?: Array<string>;
			position?: number;
			hoisted?: boolean;
			mentionable?: boolean;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.role">;
	  }
>;

export type Colibri_MessageEvent = EventBase<
	"message_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.message">;
			channel: AT_URI<"social.colibri.channel">;
			text: string;
			facets: Array<ColibriRichTextFacet>;
			createdAt: string;
			edited: boolean;
			parent?: string;
			attachments: Array<{ blob: JsonBlobRef; name?: string }>;
			/** Fully-hydrated author — always present on upsert. */
			author: ActorData;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.message">;
			channel: AT_URI<"social.colibri.channel">;
	  }
>;

export type Colibri_ReactionEvent = EventBase<
	"reaction_event",
	| {
			event: "added";
			uri: AT_URI<"social.colibri.reaction">;
			emoji: string;
			target: AT_URI<"social.colibri.message">;
			channel: AT_URI<"social.colibri.channel">;
	  }
	| {
			event: "removed";
			uri: AT_URI<"social.colibri.reaction">;
			emoji?: string;
			target?: AT_URI<"social.colibri.message">;
			channel?: AT_URI<"social.colibri.channel">;
	  }
>;

export type ColibriStatus = {
	emoji?: string;
	text: string;
	state: OnlineState;
};

export type BskyProfile = {
	displayName?: string;
	avatar?: JsonBlobRef;
	banner?: JsonBlobRef;
	description?: string;
	handle: string;
};

export type Colibri_UserEvent = EventBase<
	"user_event",
	{
		did: string;
		status?: ColibriStatus;
		profile: BskyProfile;
	}
>;

export type Colibri_TypingEvent = EventBase<
	"typing_event",
	{
		event: "start" | "stop";
		channel: AT_URI<"social.colibri.channel">;
		did: string;
	}
>;

export type Colibri_NotificationEvent = EventBase<
	"notification_event",
	{
		id: number;
		kind: "mention" | "reply";
		messageUri: string;
		authorDid: string;
		channelRkey: string;
		indexedAt: string;
		message?: {
			text: string;
			facets: Array<ColibriRichTextFacet>;
			createdAt: string;
			parent?: string;
			attachments: Array<{ blob: JsonBlobRef; name?: string }>;
			edited?: boolean;
		};
	}
>;

export type ColibriEvent =
	| AckEvent
	| Colibri_CommunityEvent
	| Colibri_MemberEvent
	| Colibri_CategoryEvent
	| Colibri_ChannelEvent
	| Colibri_RoleEvent
	| Colibri_MessageEvent
	| Colibri_ReactionEvent
	| Colibri_UserEvent
	| Colibri_TypingEvent
	| Colibri_NotificationEvent;

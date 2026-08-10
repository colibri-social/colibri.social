import type { JsonBlobRef } from "@atproto/lexicon";
import type { AT_URI } from "./atproto.js";
import type { ColibriRichTextFacet } from "./facets.js";
import type { OnlineState } from "./shared.js";
import type {
	ActorData,
	ProfileTheme,
} from "./xrpc/social.colibri/actor/getData.js";

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
			banner?: JsonBlobRef;
			categoryOrder?: Array<string>;
			requiresApprovalToJoin?: boolean;
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
	vc?: string;
	vcMuted?: boolean;
	vcDeafened?: boolean;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		isBot: boolean;
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

/**
 * Sent for changes to the moderator-facing pending-applications queue of a
 * `requiresApprovalToJoin` community. Broadcast to every client; scope by
 * `community`, not by DID.
 *
 * - `create`: a new `social.colibri.membership` was indexed, or a kicked
 *   member's original membership is still on file and re-surfaced them as a
 *   pending applicant. Fully hydrated.
 * - `resolve`: the application was admitted via `approveMembership`. Also
 *   arrives as a `member_event { join }` carrying the same `membership`
 *   AT-URI; consumers should drop the matching entry from their queues when
 *   either arrives.
 * - `dismiss`: a moderator hid the application from the active queue via
 *   `dismissApplication` (off-protocol bookkeeping — the application is still
 *   pending). Move the matching entry to the dismissed list.
 * - `undismiss`: a dismissed application was restored via
 *   `undismissApplication`. Move it back to the active queue.
 *
 * Only `create` carries the hydrated applicant (`handle`, `createdAt`,
 * `data`); the others identify the application by `membership`/`did` alone,
 * so consumers reuse the entry they already hold locally.
 */
export type Colibri_ApplicationEvent = EventBase<
	"application_event",
	| {
			event: "create";
			community: AT_URI<"social.colibri.community">;
			did: string;
			handle: string;
			membership: AT_URI<"social.colibri.membership">;
			createdAt: string;
			data: Colibri_MemberEventMember["data"];
	  }
	| {
			event: "resolve" | "dismiss" | "undismiss";
			community: AT_URI<"social.colibri.community">;
			did: string;
			membership: AT_URI<"social.colibri.membership">;
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
			category?: string;
			name?: string;
			description?: string;
			type?: string;
			ownerOnly?: boolean;
			allowedRoles?: Array<string>;
			allowedMembers?: Array<string>;
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
			live?: boolean;
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
	isBot: boolean;
	handle: string;
	/** Colibri-only profile theming, from `social.colibri.actor.profile`. */
	theme?: ProfileTheme;
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

export type Colibri_VoicePresenceEvent = EventBase<
	"voice_presence_event",
	{
		event: "join" | "leave";
		channel: AT_URI<"social.colibri.channel">;
		did: string;
	}
>;

export type Colibri_VoiceStateEvent = EventBase<
	"voice_state_event",
	{
		channel: AT_URI<"social.colibri.channel">;
		did: string;
		muted?: boolean;
		deafened?: boolean;
		serverMuted?: boolean;
		serverDeafened?: boolean;
	}
>;

export type Colibri_NotificationEvent = EventBase<
	"notification_event",
	{
		id: number;
		kind: "mention" | "reply" | "message";
		messageUri: string;
		authorDid: string;
		channelUri: string;
		indexedAt: string;
		mentionRoleName?: string;
		message: {
			text: string;
			facets: Array<ColibriRichTextFacet>;
			createdAt: string;
			parent?: string;
			attachments: Array<{ blob: JsonBlobRef; name?: string }>;
			edited?: boolean;
		};
	}
>;

/**
 * Per-user read-state sync. Pushed by the AppView only to the originating
 * user's *other* connected clients when their read state changes elsewhere, so
 * unread badges update live without a reload.
 *
 * - `channel_read`: the read cursor advanced — clear the channel's white dot.
 * - `message_seen`: a message's pings were cleared — decrement the channel's
 *   ping count by `cleared` (the number of mention/reply notifications the
 *   server cleared for that message).
 */
export type Colibri_SeenEvent = EventBase<
	"seen_event",
	| {
			event: "channel_read";
			channelUri: string;
	  }
	| {
			event: "message_seen";
			channelUri: string;
			messageUri: string;
			cleared: number;
	  }
>;

/**
 * Per-user mute sync. Pushed by the AppView only to the originating user's
 * *other* connected clients when they mute/unmute a channel or community
 * elsewhere, so the mute set (and the unread indicators it suppresses) updates
 * live without a reload.
 *
 * - `muted`: a `social.colibri.actor.mute` record was created for `subject`.
 * - `unmuted`: that record was deleted.
 *
 * `subject` is either a channel or a community AT-URI.
 */
export type Colibri_MuteEvent = EventBase<
	"mute_event",
	{
		event: "muted" | "unmuted";
		subject: string;
	}
>;

/**
 * Best-effort progress for an in-flight community creation, emitted while the
 * AppView bootstraps a "bring your own PDS" community (whose external PDS may
 * be slow). The AppView delivers it only to the creating user's own
 * connections, so there's no DID to filter on here. `step` advances
 * `connecting` → `creating` → `registering`.
 */
export type Colibri_CommunityCreationProgressEvent = EventBase<
	"community_creation_progress",
	{
		step: "connecting" | "creating" | "registering";
	}
>;

export type ColibriEvent =
	| AckEvent
	| Colibri_CommunityEvent
	| Colibri_MemberEvent
	| Colibri_ApplicationEvent
	| Colibri_CategoryEvent
	| Colibri_ChannelEvent
	| Colibri_RoleEvent
	| Colibri_MessageEvent
	| Colibri_ReactionEvent
	| Colibri_UserEvent
	| Colibri_TypingEvent
	| Colibri_VoicePresenceEvent
	| Colibri_VoiceStateEvent
	| Colibri_NotificationEvent
	| Colibri_SeenEvent
	| Colibri_MuteEvent
	| Colibri_CommunityCreationProgressEvent;

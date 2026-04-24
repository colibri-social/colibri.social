import type { JsonBlobRef } from "@atproto/lexicon";
import { AT_URI } from "./atproto.js";
import { ColibriRichTextFacet } from "./facets.js";
import { OnlineState } from "./shared.js";

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
			name: string;
			description: string;
			picture: JsonBlobRef;
			categoryOrder: Array<string>;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.community">;
	  }
>;

export type Colibri_MemberEvent = EventBase<
	"member_event",
	{
		event: "join" | "leave";
		community: AT_URI<"social.colibri.community">;
		membership: AT_URI<"social.colibri.membership">;
	}
>;

export type Colibri_CategoryEvent = EventBase<
	"category_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.category">;
			community: AT_URI<"social.colibri.community">;
			name: string;
			channelOrder: string;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.category">;
			community: AT_URI<"social.colibri.community">;
	  }
>;

export type Colibri_ChannelEvent = EventBase<
	"channel_event",
	| {
			event: "upsert";
			uri: AT_URI<"social.colibri.channel">;
			community: AT_URI<"social.colibri.community">;
			name: string;
			description: string;
			type: string;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.channel">;
			community: AT_URI<"social.colibri.community">;
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
			indexedAt: string;
			edited: boolean;
			parent: string;
			attachments: Array<JsonBlobRef>;
	  }
	| {
			event: "delete";
			uri: AT_URI<"social.colibri.message">;
			channel: AT_URI<"social.colibri.channel">;
	  }
>;

export type Colibri_ReactionEvent = EventBase<
	"reaction_event",
	{
		event: "added" | "removed";
		uri: AT_URI<"social.colibri.reaction">;
		emoji: string;
		target: AT_URI<"social.colibri.message">;
		channel: AT_URI<"social.colibri.channel">;
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

export type ColibriEvent =
	| AckEvent
	| Colibri_CommunityEvent
	| Colibri_MemberEvent
	| Colibri_CategoryEvent
	| Colibri_ChannelEvent
	| Colibri_MessageEvent
	| Colibri_ReactionEvent
	| Colibri_UserEvent
	| Colibri_TypingEvent;

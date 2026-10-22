import type { social } from "@colibri-social/lexicons";

export type ProfileView = social.colibri.beta.actor.defs.ProfileView;
export type Presence = social.colibri.beta.actor.defs.Presence;
export type Status = social.colibri.beta.actor.defs.Status;
export type VoiceState = social.colibri.beta.actor.defs.VoiceState;

export const CUSTOM_EMOJI_POLICIES = ["all", "local", "none"] as const;
export type CustomEmojiPolicy = (typeof CUSTOM_EMOJI_POLICIES)[number];
export type MigrationInfo = social.colibri.beta.community.defs.MigrationInfo;
export type CommunityView = social.colibri.beta.community.defs.CommunityView & {
	customEmoji?: CustomEmojiPolicy | (string & {});
};
export type MigrationProgressView =
	social.colibri.beta.community.defs.MigrationProgress;
export type LegacyCommunityView =
	social.colibri.beta.community.defs.LegacyCommunityView;
export type CategoryPermissions = {
	ownerOnly?: boolean;
	allowedRoles?: string[];
	allowedMembers?: Did[];
	visibleToRoles?: string[];
	visibleToMembers?: Did[];
};
export type CategoryView = social.colibri.beta.community.defs.CategoryView &
	CategoryPermissions & { private?: boolean };
export type ChannelView = social.colibri.beta.community.defs.ChannelView;
export type RoleView = social.colibri.beta.community.defs.RoleView;
export type MemberView = social.colibri.beta.community.defs.MemberView;

export type MessageView = social.colibri.beta.channel.defs.MessageView;
export type DeletedMessageView =
	social.colibri.beta.channel.defs.DeletedMessageView;
export type AttachmentView = social.colibri.beta.channel.defs.AttachmentView;
export type ReactionEmojiRef = social.colibri.beta.richtext.facet.CustomEmoji;
export type ReactionView = social.colibri.beta.channel.defs.ReactionView;
export type ForwardView = social.colibri.beta.channel.defs.ForwardView;
export type UnreadStatus = social.colibri.beta.channel.defs.UnreadStatus;

export type BridgeRegistrationView =
	social.colibri.beta.bridge.defs.RegistrationView;
export type BridgePairingView = social.colibri.beta.bridge.defs.PairingView;
export type BridgeRemoteRoom = social.colibri.beta.bridge.defs.RemoteRoom;
export type BridgeLink = social.colibri.beta.bridge.defs.Link;
export type BridgeBackfillStatus =
	social.colibri.beta.bridge.defs.BackfillStatus;

export type ThreadView = social.colibri.beta.thread.defs.ThreadView;
export type NotificationView =
	social.colibri.beta.notification.defs.NotificationView;
export type RecordRef = social.colibri.beta.defs.RecordRef;
export type EmbedRichSpan = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	href?: string;
};
export type EmbedRichBlock = {
	kind: "paragraph" | "quote" | (string & {});
	spans: EmbedRichSpan[];
};
export type EmbedAuthor = {
	name: string;
	handle?: string;
	url?: string;
	avatar?: string;
};
export type EmbedMedia = {
	kind: "image" | "video" | "gifv" | (string & {});
	url: string;
	previewUrl?: string;
	mimeType?: string;
	width?: number;
	height?: number;
	alt?: string;
};
export type EmbedStats = {
	replies?: number;
	reposts?: number;
	likes?: number;
	views?: number;
};
export type EmbedQuote = {
	uri: string;
	author: EmbedAuthor;
	body: EmbedRichBlock[];
	media?: EmbedMedia[];
	publishedAt?: string;
	translatedFrom?: string;
};
export type EmbedPost = {
	body: EmbedRichBlock[];
	sensitive?: boolean;
	contentWarning?: string;
	stats?: EmbedStats;
	quote?: EmbedQuote;
	translatedFrom?: string;
};
export type LinkEmbed = social.colibri.beta.embed.defs.LinkEmbed & {
	themeColor?: string;
	layout?: "summary" | "largeImage" | "player" | (string & {});
	provider?: { name: string; url?: string; icon?: string };
	author?: EmbedAuthor;
	publishedAt?: string;
	media?: EmbedMedia[];
	post?: EmbedPost;
};
export type GifView = social.colibri.beta.embed.defs.GifView;
export type Facet = social.colibri.beta.richtext.facet.Main;

export type Did = ProfileView["did"];
export type SpaceRef = ChannelView["space"];
export type Datetime = MessageView["createdAt"];

export const TEXT_CHANNEL = "social.colibri.beta.channel.text";
export const VOICE_CHANNEL = "social.colibri.beta.channel.voice";

export type BlueskyPostImage = {
	url: string;
	alt?: string;
	width?: number;
	height?: number;
};

export type BlueskyPostFacetFeature =
	| { $type: "app.bsky.richtext.facet#link"; uri: string }
	| { $type: "app.bsky.richtext.facet#mention"; did: string }
	| { $type: "app.bsky.richtext.facet#tag"; tag: string };

export type BlueskyPostFacet = {
	index: { byteStart: number; byteEnd: number };
	features: BlueskyPostFacetFeature[];
};

export type BlueskyPostView = {
	url: string;
	author: {
		did: Did;
		handle: string;
		displayName?: string;
		avatar?: string;
		verified?: boolean;
	};
	text: string;
	facets?: BlueskyPostFacet[];
	createdAt: Datetime;
	replyTo?: string;
	images?: BlueskyPostImage[];
	replyCount?: number;
	repostCount?: number;
	likeCount?: number;
};

export const EMBEDS_SUPPRESSED_LABEL = "embeds-suppressed";

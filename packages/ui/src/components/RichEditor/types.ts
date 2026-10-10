import type { ColibriRichTextFacet, TimestampStyle } from "@colibri-social/lib";
import type { Presence } from "../Avatar/Avatar";

export type RichText = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
};

export type MemberSuggestion = {
	did: string;
	name: string;
	handle?: string;
	avatarSrc?: string;
	presence?: Presence;
	color?: string;
};

export type BridgedSuggestion = {
	remoteId: string;
	registration: string;
	platform: string;
	platformName?: string;
	name: string;
	avatarSrc?: string;
};

export type RoleSuggestion = {
	id: string;
	name: string;
	color?: string;
};

export type ChannelKind = "text" | "voice";

export type ChannelSuggestion = {
	id: string;
	name: string;
	kind?: ChannelKind;
	categoryLabel?: string;
};

export type ChannelChip = {
	label: string;
	spaceName?: string;
	spaceAvatarSrc?: string;
	category?: string;
};

export type ChannelUrlMatch = {
	channelId: string;
	chip?: ChannelChip;
	resolve?: () => Promise<ChannelChip | undefined>;
};

export type EmojiUsageEntry = { count: number; lastUsed: number };

export type HighlightSpan = { start: number; end: number; tag: string };

export type CodeHighlighter = (
	lang: string | undefined,
	code: string,
) => HighlightSpan[] | Promise<HighlightSpan[] | null> | null;

export type TimeAttrs = {
	label: string;
	type: "time";
	datetime: string;
	style: TimestampStyle;
};

export type RichEditorSources = {
	searchMembers?: (query: string, limit: number) => MemberSuggestion[];
	searchBridged?: (query: string, limit: number) => BridgedSuggestion[];
	roles?: () => RoleSuggestion[];
	channels?: () => ChannelSuggestion[];
	resolveMember?: (did: string) => MemberSuggestion | undefined;
	resolveRole?: (id: string) => RoleSuggestion | undefined;
	resolveChannel?: (id: string) => ChannelChip | undefined;
	matchChannelUrl?: (text: string) => ChannelUrlMatch | null;
	emojiUsage?: () => Record<string, EmojiUsageEntry>;
	onEmojiPick?: (emoji: string) => void;
	highlightCode?: CodeHighlighter;
	timeShortcut?: boolean;
};

import type { ColibriRichTextFacet } from "@colibri-social/lib";
import {
	createContext,
	type JSX,
	type ParentProps,
	useContext,
} from "solid-js";

export type TextWithFacets = {
	text: string;
	facets?: Array<ColibriRichTextFacet>;
};

export type RichTextPlatform = "mobile" | "desktop";

export type RichTextMember = {
	did: string;
	name?: string;
};

export type RichTextRole = {
	rkey: string;
	name: string;
	color?: string;
};

export type RichTextChannel =
	| {
			state: "ready";
			name: string;
			category?: string;
			space?: { name: string; iconSrc?: string };
			href?: string;
	  }
	| { state: "loading" }
	| { state: "locked" };

export type RichTextLinkTarget =
	| { kind: "channel"; channel: string }
	| { kind: "internal"; href: string };

export type RichTextHighlighter = (
	lang: string | undefined,
	code: string,
) => Promise<string | null | undefined> | string | null | undefined;

export type RichTextResolvers = {
	platform?: RichTextPlatform;
	member?: (did: string) => RichTextMember | undefined;
	wrapMention?: (member: RichTextMember, chip: JSX.Element) => JSX.Element;
	role?: (rkey: string) => RichTextRole | undefined;
	wrapRole?: (role: RichTextRole, chip: JSX.Element) => JSX.Element;
	channel?: (channel: string) => RichTextChannel | undefined;
	onChannelOpen?: (channel: string, event: MouseEvent) => void;
	onLockedChannel?: (channel: string) => void;
	linkTarget?: (uri: string) => RichTextLinkTarget | undefined;
	rewriteUrl?: (uri: string) => string;
	onLinkOpen?: (href: string, event: MouseEvent) => void;
	onNavigate?: (href: string, event: MouseEvent) => void;
	bridgePlatformName?: (platform: string) => string;
	highlight?: RichTextHighlighter;
	emojiInfo?: boolean;
};

const RichTextContext = createContext<RichTextResolvers>({});

export const RichTextProvider = (
	props: ParentProps<{ value: RichTextResolvers }>,
) => (
	<RichTextContext.Provider value={props.value}>
		{props.children}
	</RichTextContext.Provider>
);

export const useRichText = () => useContext(RichTextContext);

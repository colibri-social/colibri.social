import type { $Typed } from "@atproto/api";
import type { ByteSlice } from "@atproto/api/dist/client/types/app/bsky/richtext/facet.js";

export type ColibriRichTextChannel = {
	$type?: "social.colibri.richtext.facet#channel";
	channel: string;
};

export type ColibriRichTextBold = {
	$type?: "social.colibri.richtext.facet#bold";
};

export type ColibriRichTextItalic = {
	$type?: "social.colibri.richtext.facet#italic";
};

export type ColibriRichTextUnderline = {
	$type?: "social.colibri.richtext.facet#underline";
};

export type ColibriRichTextStrikethrough = {
	$type?: "social.colibri.richtext.facet#strikethrough";
};

export type ColibriRichTextCode = {
	$type?: "social.colibri.richtext.facet#code";
};

export type ColibriRichTextCodeblock = {
	$type?: "social.colibri.richtext.facet#codeblock";
	lang?: string;
};

export type ColibriRichTextQuote = {
	$type?: "social.colibri.richtext.facet#quote";
};

export type TimestampStyle =
	| "time-short"
	| "time-long"
	| "date-short"
	| "date-long"
	| "datetime-short"
	| "datetime-long"
	| "relative";

export type ColibriRichTextTime = {
	$type?: "social.colibri.richtext.facet#time";
	datetime: string;
	style?: TimestampStyle;
};

export type ColibriRichTextMention = {
	$type?: "social.colibri.richtext.facet#mention";
	did: string;
};

export type ColibriRichTextLink = {
	$type?: "social.colibri.richtext.facet#link";
	uri: string;
};

export interface ColibriRichTextFacet {
	$type?: "social.colibri.richtext.facet";
	index: ByteSlice;
	features: (
		| $Typed<ColibriRichTextChannel>
		| $Typed<ColibriRichTextBold>
		| $Typed<ColibriRichTextItalic>
		| $Typed<ColibriRichTextUnderline>
		| $Typed<ColibriRichTextStrikethrough>
		| $Typed<ColibriRichTextCode>
		| $Typed<ColibriRichTextCodeblock>
		| $Typed<ColibriRichTextQuote>
		| $Typed<ColibriRichTextMention>
		| $Typed<ColibriRichTextLink>
		| $Typed<ColibriRichTextTime>
	)[];
}

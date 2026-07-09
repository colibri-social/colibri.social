import type { $Typed } from "@atproto/api";

interface ByteSlice {
	$type?: "app.bsky.richtext.facet#byteSlice";
	byteStart: number;
	byteEnd: number;
}

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

export type ColibriRichTextHeading = {
	$type?: "social.colibri.richtext.facet#heading";
	level: number;
};

export type ColibriRichTextList = {
	$type?: "social.colibri.richtext.facet#list";
	ordered: boolean;
};

export type ColibriRichTextSubtext = {
	$type?: "social.colibri.richtext.facet#subtext";
};

export type ColibriRichTextSpoiler = {
	$type?: "social.colibri.richtext.facet#spoiler";
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

export type ColibriRichTextRole = {
	$type?: "social.colibri.richtext.facet#role";
	role: string;
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
		| $Typed<ColibriRichTextHeading>
		| $Typed<ColibriRichTextList>
		| $Typed<ColibriRichTextSubtext>
		| $Typed<ColibriRichTextSpoiler>
		| $Typed<ColibriRichTextMention>
		| $Typed<ColibriRichTextRole>
		| $Typed<ColibriRichTextLink>
		| $Typed<ColibriRichTextTime>
	)[];
}

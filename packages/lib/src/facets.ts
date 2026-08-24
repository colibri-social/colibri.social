import type { social } from "@colibri-social/lexicons";

export type ByteSlice = social.colibri.beta.richtext.facet.ByteSlice;

export type ColibriRichTextChannel = social.colibri.beta.richtext.facet.Channel;

export type ColibriRichTextBold = social.colibri.beta.richtext.facet.Bold;

export type ColibriRichTextItalic = social.colibri.beta.richtext.facet.Italic;

export type ColibriRichTextUnderline =
	social.colibri.beta.richtext.facet.Underline;

export type ColibriRichTextStrikethrough =
	social.colibri.beta.richtext.facet.Strikethrough;

export type ColibriRichTextCode = social.colibri.beta.richtext.facet.Code;

export type ColibriRichTextCodeblock =
	social.colibri.beta.richtext.facet.Codeblock;

export type ColibriRichTextQuote = social.colibri.beta.richtext.facet.Quote;

export type ColibriRichTextHeading = social.colibri.beta.richtext.facet.Heading;

export type ColibriRichTextList = social.colibri.beta.richtext.facet.List;

export type ColibriRichTextSubtext = social.colibri.beta.richtext.facet.Subtext;

export type ColibriRichTextSpoiler = social.colibri.beta.richtext.facet.Spoiler;

export type TimestampStyle =
	| "time-short"
	| "time-long"
	| "date-short"
	| "date-long"
	| "datetime-short"
	| "datetime-long"
	| "relative";

export const TIMESTAMP_STYLES: ReadonlyArray<TimestampStyle> = [
	"time-short",
	"time-long",
	"date-short",
	"date-long",
	"datetime-short",
	"datetime-long",
	"relative",
];

export const isTimestampStyle = (value: unknown): value is TimestampStyle =>
	typeof value === "string" &&
	(TIMESTAMP_STYLES as ReadonlyArray<string>).includes(value);

export type ColibriRichTextTime = social.colibri.beta.richtext.facet.Time;

export type ColibriRichTextMention = social.colibri.beta.richtext.facet.Mention;

export type ColibriRichTextRole = social.colibri.beta.richtext.facet.Role;

export type ColibriRichTextLink = social.colibri.beta.richtext.facet.Link;

export type ColibriRichTextFacet = social.colibri.beta.richtext.facet.Main;

export type ColibriRichTextFeature = ColibriRichTextFacet["features"][number];

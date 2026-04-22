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
		| $Typed<ColibriRichTextMention>
		| $Typed<ColibriRichTextLink>
	)[];
}

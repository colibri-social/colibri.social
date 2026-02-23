import type { $Typed, AppBskyRichtextFacet } from "@atproto/api";
import type { ByteSlice } from "@atproto/api/dist/client/types/app/bsky/richtext/facet";
import TLDs from "tlds";
import type { UnicodeString } from "./unicode";
import {
	CHANNEL_REGEX,
	MENTION_REGEX,
	TRAILING_PUNCTUATION_REGEX,
	URL_REGEX,
} from "./util";

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
	)[];
}

export type Facet = AppBskyRichtextFacet.Main | ColibriRichTextFacet;

export function detectFacets(text: UnicodeString): Facet[] | undefined {
	let match: RegExpExecArray | null;
	const facets: Facet[] = [];
	{
		// mentions
		const re = MENTION_REGEX;
		while ((match = re.exec(text.utf16))) {
			if (!isValidDomain(match[3]) && !match[3].endsWith(".test")) {
				continue; // probably not a handle
			}

			const start = text.utf16.indexOf(match[3], match.index) - 1;
			facets.push({
				$type: "app.bsky.richtext.facet",
				index: {
					byteStart: text.utf16IndexToUtf8Index(start),
					byteEnd: text.utf16IndexToUtf8Index(start + match[3].length + 1),
				},
				features: [
					{
						$type: "app.bsky.richtext.facet#mention",
						did: match[3], // must be resolved afterwards
					},
				],
			});
		}
	}
	{
		// links
		const re = URL_REGEX;
		while ((match = re.exec(text.utf16))) {
			let uri = match[2];
			if (!uri.startsWith("http")) {
				const domain = match.groups?.domain;
				if (!domain || !isValidDomain(domain)) {
					continue;
				}
				uri = `https://${uri}`;
			}
			const start = text.utf16.indexOf(match[2], match.index);
			const index = { start, end: start + match[2].length };
			// strip ending puncuation
			if (/[.,;:!?]$/.test(uri)) {
				uri = uri.slice(0, -1);
				index.end--;
			}
			if (/[)]$/.test(uri) && !uri.includes("(")) {
				uri = uri.slice(0, -1);
				index.end--;
			}
			facets.push({
				index: {
					byteStart: text.utf16IndexToUtf8Index(index.start),
					byteEnd: text.utf16IndexToUtf8Index(index.end),
				},
				features: [
					{
						$type: "app.bsky.richtext.facet#link",
						uri,
					},
				],
			});
		}
	}
	{
		const re = CHANNEL_REGEX;
		while ((match = re.exec(text.utf16))) {
			const leading = match[1];
			let channel = match[2];

			if (!channel) continue;

			// strip ending punctuation and any spaces
			channel = channel.trim().replace(TRAILING_PUNCTUATION_REGEX, "");

			if (channel.length === 0 || channel.length > 64) continue;

			const index = match.index + leading.length;

			facets.push({
				index: {
					byteStart: text.utf16IndexToUtf8Index(index),
					byteEnd: text.utf16IndexToUtf8Index(index + 1 + channel.length),
				},
				features: [
					{
						$type: "social.colibri.richtext.facet#channel",
						channel: channel,
					},
				],
			});
		}
	}
	return facets.length > 0 ? facets : undefined;
}

function isValidDomain(str: string): boolean {
	return !!TLDs.find((tld) => {
		const i = str.lastIndexOf(tld);
		if (i === -1) {
			return false;
		}
		return str.charAt(i - 1) === "." && i === str.length - tld.length;
	});
}

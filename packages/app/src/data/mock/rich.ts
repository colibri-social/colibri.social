import type { Did, Facet } from "../types";

const FACET = "social.colibri.beta.richtext.facet";

type Feature = Facet["features"][number];

const feature = (kind: string, fields: Record<string, unknown> = {}) =>
	({ $type: `${FACET}#${kind}`, ...fields }) as Feature;

export const fx = {
	bold: () => feature("bold"),
	italic: () => feature("italic"),
	underline: () => feature("underline"),
	strike: () => feature("strikethrough"),
	code: () => feature("code"),
	spoiler: () => feature("spoiler"),
	quote: () => feature("quote"),
	subtext: () => feature("subtext"),
	link: (uri: string) => feature("link", { uri }),
	mention: (did: Did) => feature("mention", { did }),
	bridged: (platform: string, remoteId: string) =>
		feature("bridgedMention", {
			registration: "3lbridgereg22",
			platform,
			remoteId,
		}),
	role: (role: string) => feature("role", { role }),
	channel: (channel: string) => feature("channel", { channel }),
	time: (datetime: string, style?: string) =>
		feature("time", style ? { datetime, style } : { datetime }),
	codeblock: (lang?: string) => feature("codeblock", lang ? { lang } : {}),
	heading: (level: number) => feature("heading", { level }),
	list: (ordered = false, indent?: number) =>
		feature("list", indent ? { ordered, indent } : { ordered }),
};

export type Part =
	| string
	| { text: string; features: Feature[] }
	| { block: Feature[]; parts: Part[] };

export type RichTextValue = { text: string; facets?: Facet[] };

const encoder = new TextEncoder();

export const byteLength = (value: string) => encoder.encode(value).length;

export const rich = (...parts: Part[]): RichTextValue => {
	let text = "";
	const facets: Facet[] = [];
	const offset = () => byteLength(text);
	const walk = (list: Part[]) => {
		for (const part of list) {
			if (typeof part === "string") {
				text += part;
				continue;
			}
			const start = offset();
			if ("text" in part) text += part.text;
			else walk(part.parts);
			const end = offset();
			if (end > start) {
				facets.push({
					$type: FACET,
					index: { byteStart: start, byteEnd: end },
					features: "text" in part ? part.features : part.block,
				} as Facet);
			}
		}
	};
	walk(parts);
	return facets.length ? { text, facets } : { text };
};

export const mark = (text: string, ...features: Feature[]) => ({
	text,
	features,
});

export const block = (features: Feature[], ...parts: Part[]) => ({
	block: features,
	parts,
});

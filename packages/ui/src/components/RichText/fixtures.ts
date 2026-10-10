import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { TextWithFacets } from "./context";

export type Feature = ColibriRichTextFacet["features"][number];

export const FACET = "social.colibri.beta.richtext.facet";

export const feature = (kind: string, fields: Record<string, unknown> = {}) =>
	({ $type: `${FACET}#${kind}`, ...fields }) as Feature;

type FeatureFactories = {
	bold: Feature;
	italic: Feature;
	underline: Feature;
	strike: Feature;
	code: Feature;
	spoiler: Feature;
	quote: Feature;
	subtext: Feature;
	link: (uri: string) => Feature;
	mention: (did: string) => Feature;
	bridged: (platform: string) => Feature;
	role: (role: string) => Feature;
	channel: (channel: string) => Feature;
	time: (datetime: string, style?: string) => Feature;
	codeblock: (lang?: string) => Feature;
	heading: (level: number) => Feature;
	list: (ordered?: boolean, indent?: number) => Feature;
};

export const f: FeatureFactories = {
	bold: feature("bold"),
	italic: feature("italic"),
	underline: feature("underline"),
	strike: feature("strikethrough"),
	code: feature("code"),
	spoiler: feature("spoiler"),
	quote: feature("quote"),
	subtext: feature("subtext"),
	link: (uri: string) => feature("link", { uri }),
	mention: (did: string) => feature("mention", { did }),
	bridged: (platform: string) =>
		feature("bridgedMention", {
			platform,
			registration: "reg",
			remoteId: "1",
		}),
	role: (role: string) => feature("role", { role }),
	channel: (channel: string) => feature("channel", { channel }),
	time: (datetime: string, style?: string) =>
		feature("time", { datetime, style }),
	codeblock: (lang?: string) => feature("codeblock", { lang }),
	heading: (level: number) => feature("heading", { level }),
	list: (ordered = false, indent?: number) =>
		feature("list", { ordered, indent }),
};

type Part =
	| string
	| { text: string; features: Feature[] }
	| { block: Feature[]; parts: Part[] };

export const encoder = new TextEncoder();

export const build = (parts: Part[]): TextWithFacets => {
	let text = "";
	const facets: ColibriRichTextFacet[] = [];
	const offset = () => encoder.encode(text).length;
	const push = (byteStart: number, features: Feature[]) =>
		facets.push({
			$type: FACET,
			index: { byteStart, byteEnd: offset() },
			features,
		} as ColibriRichTextFacet);
	const walk = (list: Part[]) => {
		for (const part of list) {
			if (typeof part === "string") {
				text += part;
			} else if ("text" in part) {
				const start = offset();
				text += part.text;
				push(start, part.features);
			} else {
				const start = offset();
				walk(part.parts);
				push(start, part.block);
			}
		}
	};
	walk(parts);
	return { text, facets };
};

export const mark = (
	text: string,
	...features: Feature[]
): { text: string; features: Feature[] } => ({
	text,
	features,
});

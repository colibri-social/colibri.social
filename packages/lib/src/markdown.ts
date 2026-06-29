import type { Nodes, Parent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import type { ColibriRichTextFacet } from "./facets.js";

type Feature = ColibriRichTextFacet["features"][number];

const FROM_MARKDOWN_OPTIONS = {
	extensions: [gfmStrikethrough({ singleTilde: false })],
	mdastExtensions: [gfmStrikethroughFromMarkdown()],
};

/**
 * An inline/block formatting span discovered in raw markdown source.
 */
export type MarkdownTokenKind =
	| "bold"
	| "italic"
	| "underline"
	| "strikethrough"
	| "code"
	| "codeblock"
	| "quote"
	| "link"
	| "heading"
	| "list"
	| "subtext"
	| "spoiler";

export interface MarkdownToken {
	kind: MarkdownTokenKind;
	markers: Array<[number, number]>;
	content: [number, number];
	lang?: string;
	uri?: string;
	level?: number;
	ordered?: boolean;
}

const FEATURE_TYPE: Record<MarkdownTokenKind, Feature["$type"]> = {
	bold: "social.colibri.richtext.facet#bold",
	italic: "social.colibri.richtext.facet#italic",
	underline: "social.colibri.richtext.facet#underline",
	strikethrough: "social.colibri.richtext.facet#strikethrough",
	code: "social.colibri.richtext.facet#code",
	codeblock: "social.colibri.richtext.facet#codeblock",
	quote: "social.colibri.richtext.facet#quote",
	link: "social.colibri.richtext.facet#link",
	heading: "social.colibri.richtext.facet#heading",
	list: "social.colibri.richtext.facet#list",
	subtext: "social.colibri.richtext.facet#subtext",
	spoiler: "social.colibri.richtext.facet#spoiler",
};

const INLINE_MARKER: Partial<Record<MarkdownTokenKind, string>> = {
	bold: "**",
	italic: "*",
	underline: "__",
	strikethrough: "~~",
	code: "`",
	spoiler: "||",
};

const encoder = new TextEncoder();

const offset = (node: { position?: { start: { offset?: number } } }): number =>
	node.position?.start.offset ?? 0;

const endOffset = (node: { position?: { end: { offset?: number } } }): number =>
	node.position?.end.offset ?? 0;

const wrapMarkers = (
	node: Parent,
): { markers: Array<[number, number]>; content: [number, number] } | null => {
	const kids = node.children;
	if (!kids.length) return null;
	const contentStart = offset(kids[0]);
	const contentEnd = endOffset(kids[kids.length - 1]);
	return {
		markers: [
			[offset(node), contentStart],
			[contentEnd, endOffset(node)],
		],
		content: [contentStart, contentEnd],
	};
};

/**
 * Walks the mdast tree for a raw message and returns every formatting span
 */
export const tokenizeMarkdown = (source: string): MarkdownToken[] => {
	const tree = fromMarkdown(source, FROM_MARKDOWN_OPTIONS);
	const tokens: MarkdownToken[] = [];

	const visit = (node: Nodes): void => {
		switch (node.type) {
			case "strong": {
				const w = wrapMarkers(node);
				if (w) {
					tokens.push({
						kind: source[offset(node)] === "_" ? "underline" : "bold",
						...w,
					});
				}
				break;
			}
			case "emphasis": {
				const w = wrapMarkers(node);
				if (w) tokens.push({ kind: "italic", ...w });
				break;
			}
			case "delete": {
				const w = wrapMarkers(node);
				if (w) tokens.push({ kind: "strikethrough", ...w });
				break;
			}
			case "inlineCode": {
				const start = offset(node);
				const end = endOffset(node);
				let n = 0;
				while (source[start + n] === "`") n++;
				const contentStart = start + n;
				const contentEnd = end - n;
				if (contentEnd > contentStart) {
					tokens.push({
						kind: "code",
						markers: [
							[start, contentStart],
							[contentEnd, end],
						],
						content: [contentStart, contentEnd],
					});
				}
				break;
			}
			case "link": {
				const kids = node.children;
				if (kids.length && node.url) {
					const contentStart = offset(kids[0]);
					const contentEnd = endOffset(kids[kids.length - 1]);
					tokens.push({
						kind: "link",
						markers: [
							[offset(node), contentStart],
							[contentEnd, endOffset(node)],
						],
						content: [contentStart, contentEnd],
						uri: node.url,
					});
				}
				break;
			}
			case "code": {
				const start = offset(node);
				const end = endOffset(node);
				const fenceChar = source[start];
				if (fenceChar === "`" || fenceChar === "~") {
					const firstNewline = source.indexOf("\n", start);
					if (firstNewline !== -1 && firstNewline < end) {
						const contentStart = firstNewline + 1;
						let contentEnd = source.lastIndexOf("\n", end - 1);
						if (contentEnd < contentStart) contentEnd = contentStart;
						tokens.push({
							kind: "codeblock",
							markers: [
								[start, contentStart],
								[contentEnd, end],
							],
							content: [contentStart, contentEnd],
							lang: node.lang || undefined,
						});
					}
				}
				break;
			}
			case "heading": {
				if (node.depth > 3 || source[offset(node)] !== "#") break;
				const w = wrapMarkers(node);
				if (w) tokens.push({ kind: "heading", level: node.depth, ...w });
				break;
			}
			case "list": {
				for (const item of node.children) {
					if (item.type !== "listItem") continue;

					const para =
						item.children.find((k) => k.type === "paragraph") ??
						item.children[0];

					if (!para) continue;

					const contentStart = offset(para);
					let contentEnd = endOffset(para);
					const nl = source.indexOf("\n", contentStart);

					if (nl !== -1 && nl < contentEnd) contentEnd = nl;
					if (contentEnd <= contentStart) continue;

					tokens.push({
						kind: "list",
						ordered: Boolean(node.ordered),
						markers: [[offset(item), contentStart]],
						content: [contentStart, contentEnd],
					});
				}
				break;
			}
			case "blockquote": {
				const start = offset(node);
				const end = endOffset(node);
				const markers: Array<[number, number]> = [];
				let lineStart = start;
				while (lineStart < end) {
					let p = lineStart;
					while (p < end && source[p] === " " && p - lineStart < 3) p++;
					if (source[p] === ">") {
						let markerEnd = p + 1;
						if (source[markerEnd] === " ") markerEnd++;
						markers.push([lineStart, markerEnd]);
					}
					const nl = source.indexOf("\n", lineStart);
					if (nl === -1 || nl >= end) break;
					lineStart = nl + 1;
				}
				tokens.push({ kind: "quote", markers, content: [start, end] });
				break;
			}
		}

		if ("children" in node) {
			for (const child of node.children) visit(child);
		}
	};

	visit(tree);

	const codeRanges = tokens
		.filter((t) => t.kind === "code" || t.kind === "codeblock")
		.map(
			(t) =>
				[t.markers[0][0], (t.markers[1] ?? t.markers[0])[1]] as [
					number,
					number,
				],
		);
	const insideCode = (index: number): boolean =>
		codeRanges.some(([s, e]) => index >= s && index < e);

	const subtextRe = /(^|\n)([ \t]{0,3}-#[ \t])([^\n]*)/g;

	let sub: RegExpExecArray | null;
	while ((sub = subtextRe.exec(source))) {
		const lineStart = sub.index + sub[1].length;
		const markerEnd = lineStart + sub[2].length;
		const contentEnd = markerEnd + sub[3].length;
		if (contentEnd <= markerEnd || insideCode(lineStart)) continue;
		tokens.push({
			kind: "subtext",
			markers: [[lineStart, markerEnd]],
			content: [markerEnd, contentEnd],
		});
	}

	const spoilerRe = /\|\|([^\n]+?)\|\|/g;

	let sp: RegExpExecArray | null;
	while ((sp = spoilerRe.exec(source))) {
		const start = sp.index;
		const end = start + sp[0].length;
		const contentStart = start + 2;
		const contentEnd = end - 2;
		if (contentEnd <= contentStart || insideCode(start)) continue;
		tokens.push({
			kind: "spoiler",
			markers: [
				[start, contentStart],
				[contentEnd, end],
			],
			content: [contentStart, contentEnd],
		});
	}

	return tokens.sort((a, b) => a.content[0] - b.content[0]);
};

const buildFeature = (token: MarkdownToken): Feature => {
	switch (token.kind) {
		case "codeblock":
			return {
				$type: "social.colibri.richtext.facet#codeblock",
				...(token.lang ? { lang: token.lang } : {}),
			};
		case "link":
			return {
				$type: "social.colibri.richtext.facet#link",
				uri: token.uri ?? "",
			};
		case "heading":
			return {
				$type: "social.colibri.richtext.facet#heading",
				level: token.level ?? 1,
			};
		case "list":
			return {
				$type: "social.colibri.richtext.facet#list",
				ordered: Boolean(token.ordered),
			};
		default:
			return { $type: FEATURE_TYPE[token.kind] } as Feature;
	}
};

/**
 * An additional facet to carry through marker stripping
 */
export interface SourceFacet {
	start: number;
	end: number;
	features: Feature[];
}

export interface ParsedMarkdown {
	text: string;
	facets: Array<ColibriRichTextFacet>;
}

/**
 * Parses raw markdown source into the stored representation
 */
export const parseMarkdown = (
	source: string,
	extra: SourceFacet[] = [],
): ParsedMarkdown => {
	const tokens = tokenizeMarkdown(source);
	const removed = tokens.flatMap((t) => t.markers).sort((a, b) => a[0] - b[0]);

	let text = "";
	let cursor = 0;
	for (const [start, end] of removed) {
		if (start < cursor) continue;
		text += source.slice(cursor, start);
		cursor = end;
	}
	text += source.slice(cursor);

	const mapToClean = (index: number): number => {
		let delta = 0;
		for (const [start, end] of removed) {
			if (end <= index) delta += end - start;
			else if (start < index) delta += index - start;
		}
		return index - delta;
	};
	const cleanToByte = (index: number): number =>
		encoder.encode(text.slice(0, index)).length;

	const facets: Array<ColibriRichTextFacet> = [];
	const pushFacet = (
		startStr: number,
		endStr: number,
		features: Feature[],
	): void => {
		const cleanStart = mapToClean(startStr);
		const cleanEnd = mapToClean(endStr);
		facets.push({
			$type: "social.colibri.richtext.facet",
			index: {
				$type: "app.bsky.richtext.facet#byteSlice",
				byteStart: cleanToByte(cleanStart),
				byteEnd: cleanToByte(cleanEnd),
			},
			features,
		});
	};

	for (const token of tokens) {
		pushFacet(token.content[0], token.content[1], [buildFeature(token)]);
	}
	for (const ex of extra) {
		pushFacet(ex.start, ex.end, ex.features);
	}

	facets.sort(
		(a, b) =>
			a.index.byteStart - b.index.byteStart ||
			a.index.byteEnd - b.index.byteEnd,
	);

	return { text, facets };
};

const ATOM_KIND = new Set(["mention", "channel", "time"]);

export interface SourceAtom {
	start: number;
	end: number;
	feature: Feature;
}

export interface SourceWithAtoms {
	source: string;
	atoms: SourceAtom[];
}

const featureKind = (feature: Feature): string =>
	(feature.$type ?? "").split("#")[1] ?? "";

/**
 * The inverse of {@link parseMarkdown}: rebuilds raw markdown source from stored
 * clean text + facets, re-injecting the literal syntax markers so the editor can
 * show them
 */
export const facetsToSource = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
): SourceWithAtoms => {
	const byteToStr = new Map<number, number>();
	{
		let byte = 0;
		for (let i = 0; i <= text.length; i++) {
			byteToStr.set(byte, i);
			if (i < text.length) byte += encoder.encode(text[i]).length;
		}
	}
	const toStr = (byte: number): number => byteToStr.get(byte) ?? text.length;

	const opensAt = new Map<number, string[]>();
	const closesAt = new Map<number, string[]>();
	const addMarker = (
		map: Map<number, string[]>,
		index: number,
		value: string,
	) => {
		const arr = map.get(index);
		if (arr) arr.push(value);
		else map.set(index, [value]);
	};
	const codeblocks: Array<[number, number, string]> = [];
	const atomStarts = new Map<number, { end: number; feature: Feature }>();
	const listFacets: Array<{ start: number; end: number; ordered: boolean }> =
		[];
	const quoteRanges: Array<[number, number]> = [];

	for (const facet of facets) {
		const start = toStr(facet.index.byteStart);
		const end = toStr(facet.index.byteEnd);
		for (const feature of facet.features) {
			const kind = featureKind(feature);
			const inline = INLINE_MARKER[kind as MarkdownTokenKind];
			if (inline) {
				addMarker(opensAt, start, inline);
				addMarker(closesAt, end, inline);
			} else if (kind === "link") {
				addMarker(opensAt, start, "[");
				addMarker(closesAt, end, `](${"uri" in feature ? feature.uri : ""})`);
			} else if (kind === "codeblock") {
				codeblocks.push([
					start,
					end,
					"lang" in feature && feature.lang ? feature.lang : "",
				]);
			} else if (kind === "heading") {
				const level = "level" in feature ? Number(feature.level) || 1 : 1;
				addMarker(opensAt, start, `${"#".repeat(Math.min(3, level))} `);
			} else if (kind === "subtext") {
				addMarker(opensAt, start, "-# ");
			} else if (kind === "list") {
				listFacets.push({
					start,
					end,
					ordered: "ordered" in feature && Boolean(feature.ordered),
				});
			} else if (kind === "quote") {
				quoteRanges.push([start, end]);
			} else if (ATOM_KIND.has(kind)) {
				atomStarts.set(start, { end, feature });
			}
		}
	}

	listFacets.sort((a, b) => a.start - b.start);
	let counter = 0;
	let prevEnd = -2;
	for (const lf of listFacets) {
		if (!(lf.ordered && lf.start === prevEnd + 1)) counter = 0;
		if (lf.ordered) {
			counter++;
			addMarker(opensAt, lf.start, `${counter}. `);
		} else {
			addMarker(opensAt, lf.start, "- ");
		}
		prevEnd = lf.end;
	}

	codeblocks.sort((a, b) => a[0] - b[0]);

	const quoteLineStarts = new Set<number>();
	for (const [qs, qe] of quoteRanges) {
		quoteLineStarts.add(qs);
		for (let p = qs; p < qe - 1; p++) {
			if (text[p] === "\n") quoteLineStarts.add(p + 1);
		}
	}

	let out = "";
	let i = 0;
	const atoms: SourceAtom[] = [];
	let pending: {
		cleanEnd: number;
		feature: Feature;
		sourceStart: number;
	} | null = null;

	while (i <= text.length) {
		const fence = codeblocks.find(([s]) => s === i);
		if (pending && i === pending.cleanEnd) {
			atoms.push({
				start: pending.sourceStart,
				end: out.length,
				feature: pending.feature,
			});
			pending = null;
		}
		const closers = closesAt.get(i);
		if (closers) for (const m of [...closers].reverse()) out += m;
		if (i === text.length) break;

		if (quoteLineStarts.has(i)) out += "> ";

		if (fence) {
			out += `\`\`\`${fence[2]}\n`;
			out += text.slice(i, fence[1]);
			out += "\n```";
			i = fence[1];
			continue;
		}

		const openers = opensAt.get(i);
		if (openers) for (const m of openers) out += m;

		const atom = atomStarts.get(i);
		if (atom) {
			pending = {
				cleanEnd: atom.end,
				feature: atom.feature,
				sourceStart: out.length,
			};
		}

		out += text[i];
		i++;
	}

	return { source: out, atoms };
};

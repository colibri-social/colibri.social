import {
	type ColibriRichTextFacet,
	indentWidthAt,
	isSingleLineGap,
	normalizeWhitespace,
	resolveListDepths,
} from "@colibri-social/lib";
import type { JSX } from "solid-js";
import { splitEmojiSegments } from "../../utils/emoji";
import { aliasesForSlug, slugForEmoji } from "../../utils/emoji-data";
import {
	buildFeatureKey,
	normalizeFacets,
} from "../../utils/rich-text/normalize-facets";
import type { RichTextResolvers, TextWithFacets } from "./context";
import {
	BridgedMentionFacet,
	ChannelChip,
	CodeBlock,
	LinkFacet,
	MentionFacet,
	RoleFacet,
	Spoiler,
	Timestamp,
} from "./facets";

type Feature = ColibriRichTextFacet["features"][number];

const SKIN_TONE = /[\u{1F3FB}-\u{1F3FF}]/gu;

export const emojiSlug = (emoji: string) =>
	slugForEmoji(emoji) ?? slugForEmoji(emoji.replace(SKIN_TONE, ""));

export const emojiShortcode = (slug: string) => aliasesForSlug(slug)[0] ?? slug;

const PLAIN_EMOJI_KINDS = new Set(["code", "link"]);

const emojiText = (segment: string, ctx: RichTextResolvers): JSX.Element => {
	if (ctx.emojiInfo === false) return segment;
	const parts = splitEmojiSegments(segment);
	if (!parts.some((part) => part.kind === "emoji")) return segment;
	return parts.map((part) => {
		if (part.kind === "text") return part.value;
		const slug = emojiSlug(part.value);
		if (!slug) return part.value;
		return (
			// biome-ignore lint/a11y/useSemanticElements: inline emoji stay selectable text inside the paragraph
			<span
				role="button"
				tabIndex={0}
				data-emoji-button=""
				data-emoji={part.value}
				data-slug={slug}
				aria-label={`:${emojiShortcode(slug)}:`}
				class="cursor-pointer rounded-[4px] outline-none focus-ring"
			>
				{part.value}
			</span>
		);
	});
};

const FACET = "social.colibri.beta.richtext.facet#";

const kindOf = (feature: Feature): string => {
	const type = feature.$type ?? "";
	return type.startsWith(FACET) ? type.slice(FACET.length) : "";
};

const field = (feature: Feature, key: string): unknown =>
	(feature as Record<string, unknown>)[key];

const stringField = (feature: Feature, key: string): string => {
	const value = field(feature, key);
	return value === undefined || value === null ? "" : String(value);
};

const BLOCK_KINDS = new Set([
	"codeblock",
	"quote",
	"heading",
	"subtext",
	"list",
]);
const ANCHOR_KINDS = ["channel", "mention", "bridgedMention", "role", "time"];

const isBlockFeature = (feature: Feature) => BLOCK_KINDS.has(kindOf(feature));

const isQuoteFacet = (facet: ColibriRichTextFacet) =>
	facet.features.some((feature) => kindOf(feature) === "quote");

const withoutQuote = (facet: ColibriRichTextFacet): ColibriRichTextFacet => ({
	...facet,
	features: facet.features.filter((feature) => kindOf(feature) !== "quote"),
});

const compareBlockFacets = (
	a: ColibriRichTextFacet,
	b: ColibriRichTextFacet,
): number => {
	if (a.index.byteStart !== b.index.byteStart) {
		return a.index.byteStart - b.index.byteStart;
	}
	if (a.index.byteEnd !== b.index.byteEnd) {
		return b.index.byteEnd - a.index.byteEnd;
	}
	return Number(isQuoteFacet(b)) - Number(isQuoteFacet(a));
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const snapToCharBoundary = (bytes: Uint8Array, index: number): number => {
	let next = Math.min(Math.max(index, 0), bytes.length);
	while (next < bytes.length && (bytes[next] & 0xc0) === 0x80) next++;
	return next;
};

const sanitizeFacets = (
	bytes: Uint8Array,
	facets: Array<ColibriRichTextFacet>,
): Array<ColibriRichTextFacet> =>
	facets
		.filter(
			(facet) =>
				Number.isFinite(facet.index?.byteStart) &&
				Number.isFinite(facet.index?.byteEnd) &&
				Array.isArray(facet.features),
		)
		.map((facet) => ({
			...facet,
			index: {
				...facet.index,
				byteStart: snapToCharBoundary(bytes, facet.index.byteStart),
				byteEnd: snapToCharBoundary(bytes, facet.index.byteEnd),
			},
		}))
		.filter((facet) => facet.index.byteEnd > facet.index.byteStart);

const WRAP_RANK: Record<string, number> = { link: 1, spoiler: 2 };

const wrapRank = (kind: string) => WRAP_RANK[kind] ?? 0;

const wrapMark = (
	feature: Feature,
	segment: string,
	inner: JSX.Element,
	ctx: RichTextResolvers,
): JSX.Element => {
	switch (kindOf(feature)) {
		case "bold":
			return (
				<strong data-facet-type="bold" class="font-bold">
					{inner}
				</strong>
			);
		case "italic":
			return (
				<em data-facet-type="italic" class="italic">
					{inner}
				</em>
			);
		case "underline":
			return (
				<u data-facet-type="underline" class="underline">
					{inner}
				</u>
			);
		case "strikethrough":
			return (
				<s data-facet-type="strikethrough" class="line-through">
					{inner}
				</s>
			);
		case "code":
			return (
				<code
					data-facet-type="code"
					class="rounded-[4px] bg-secondary px-1 py-px font-mono text-[0.875em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
				>
					{inner}
				</code>
			);
		case "spoiler":
			return <Spoiler>{inner}</Spoiler>;
		case "link": {
			const uri = stringField(feature, "uri");
			if (!uri) return inner;
			return (
				<LinkFacet uri={uri} label={segment} ctx={ctx}>
					{inner}
				</LinkFacet>
			);
		}
		default:
			return inner;
	}
};

const renderAnchor = (
	feature: Feature,
	segment: string,
	ctx: RichTextResolvers,
): JSX.Element => {
	switch (kindOf(feature)) {
		case "channel":
			return (
				<ChannelChip
					channel={stringField(feature, "channel")}
					text={segment}
					ctx={ctx}
				/>
			);
		case "mention":
			return (
				<MentionFacet
					did={stringField(feature, "did")}
					text={segment}
					ctx={ctx}
				/>
			);
		case "bridgedMention":
			return (
				<BridgedMentionFacet
					platform={stringField(feature, "platform")}
					text={segment}
					ctx={ctx}
				/>
			);
		case "role":
			return (
				<RoleFacet
					rkey={stringField(feature, "role")}
					text={segment}
					ctx={ctx}
				/>
			);
		default:
			return (
				<Timestamp
					datetime={stringField(feature, "datetime")}
					style={field(feature, "style")}
					fallback={segment}
				/>
			);
	}
};

const renderInlineRange = (
	bytes: Uint8Array,
	rangeStart: number,
	rangeEnd: number,
	facets: Array<ColibriRichTextFacet>,
	ctx: RichTextResolvers,
): Array<JSX.Element> => {
	const boundaries = new Set<number>([rangeStart, rangeEnd]);
	for (const facet of facets) {
		const { byteStart, byteEnd } = facet.index;
		if (byteStart > rangeStart && byteStart < rangeEnd)
			boundaries.add(byteStart);
		if (byteEnd > rangeStart && byteEnd < rangeEnd) boundaries.add(byteEnd);
	}
	const sorted = [...boundaries].sort((a, b) => a - b);
	const result: Array<JSX.Element> = [];

	for (let index = 0; index < sorted.length - 1; index++) {
		const start = sorted[index];
		const end = sorted[index + 1];
		if (start === end) continue;

		const segment = decoder.decode(bytes.subarray(start, end));
		const features: Feature[] = [];
		const seen = new Set<string>();
		for (const facet of facets) {
			if (facet.index.byteStart > start || facet.index.byteEnd < end) continue;
			for (const feature of facet.features) {
				if (isBlockFeature(feature)) continue;
				const key = buildFeatureKey(feature);
				if (seen.has(key)) continue;
				seen.add(key);
				features.push(feature);
			}
		}

		const anchor = ANCHOR_KINDS.map((kind) =>
			features.find((feature) => kindOf(feature) === kind),
		).find(Boolean);

		if (anchor) {
			result.push(renderAnchor(anchor, segment, ctx));
			continue;
		}

		const plain = features.some((feature) =>
			PLAIN_EMOJI_KINDS.has(kindOf(feature)),
		);
		let element: JSX.Element = plain ? segment : emojiText(segment, ctx);
		const ordered = [...features].sort(
			(a, b) => wrapRank(kindOf(a)) - wrapRank(kindOf(b)),
		);
		for (const feature of ordered) {
			element = wrapMark(feature, segment, element, ctx);
		}
		result.push(element);
	}

	return result;
};

const listFeatureOf = (facet: ColibriRichTextFacet) =>
	facet.features.find((feature) => kindOf(feature) === "list");

const BULLET_CLASS = ["list-disc", "list-[circle]", "list-[square]"];
const MAX_LIST_DEPTH = 10;

type ListItem = { facet: ColibriRichTextFacet; children: Array<ListNode> };
type ListNode = { ordered: boolean; items: Array<ListItem> };
type ListLevel = { node: ListNode; lastItem?: ListItem };

const renderList = (
	items: Array<ColibriRichTextFacet>,
	byteAt: (index: number) => string | undefined,
	inline: (start: number, end: number) => Array<JSX.Element>,
): Array<JSX.Element> => {
	const depths = resolveListDepths(
		items.map((facet) => {
			const feature = listFeatureOf(facet);
			const indent = feature ? field(feature, "indent") : undefined;
			return {
				indent: indent === undefined ? undefined : Number(indent),
				indentWidth: indentWidthAt(byteAt, facet.index.byteStart),
			};
		}),
	);

	const roots: Array<ListNode> = [];
	const levels: Array<ListLevel> = [];

	const attach = (node: ListNode): boolean => {
		if (levels.length === 0) {
			roots.push(node);
			return true;
		}
		const host = levels[levels.length - 1].lastItem;
		if (!host) return false;
		host.children.push(node);
		return true;
	};

	for (const [index, facet] of items.entries()) {
		const feature = listFeatureOf(facet);
		const ordered = !!feature && !!field(feature, "ordered");
		const depth = Math.min(depths[index], MAX_LIST_DEPTH);

		while (levels.length > depth + 1) levels.pop();
		while (levels.length < depth + 1) {
			const node: ListNode = { ordered, items: [] };
			if (!attach(node)) break;
			levels.push({ node });
		}

		let level = levels[levels.length - 1];
		if (level.node.ordered !== ordered && level.node.items.length > 0) {
			levels.pop();
			const sibling: ListNode = { ordered, items: [] };
			if (attach(sibling)) {
				level = { node: sibling };
				levels.push(level);
			} else {
				levels.push(level);
			}
		}

		const item: ListItem = { facet, children: [] };
		level.node.items.push(item);
		level.lastItem = item;
	}

	const renderNode = (node: ListNode, depth: number): JSX.Element => {
		const children = node.items.map((item) => (
			<li>
				{inline(item.facet.index.byteStart, item.facet.index.byteEnd)}
				{item.children.map((child) => renderNode(child, depth + 1))}
			</li>
		));
		const spacing = depth === 0 ? "my-1 pl-1" : "my-0 pl-4";
		return node.ordered ? (
			<ol data-facet-type="list" class={`list-inside list-decimal ${spacing}`}>
				{children}
			</ol>
		) : (
			<ul
				data-facet-type="list"
				class={`list-inside ${BULLET_CLASS[depth % BULLET_CLASS.length]} ${spacing}`}
			>
				{children}
			</ul>
		);
	};

	return roots.map((root) => renderNode(root, 0));
};

const HEADING_CLASS: Record<number, string> = {
	1: "my-1 block text-xl leading-7 font-bold",
	2: "my-1 block text-lg leading-6 font-bold",
	3: "my-1 block text-base font-bold",
};

const renderBlockRange = (
	bytes: Uint8Array,
	rangeStart: number,
	rangeEnd: number,
	blockFacets: Array<ColibriRichTextFacet>,
	inline: (start: number, end: number) => Array<JSX.Element>,
	ctx: RichTextResolvers,
): Array<JSX.Element> => {
	const result: Array<JSX.Element> = [];
	let cursor = rangeStart;
	let lastWasBlock = false;

	const byteAt = (index: number): string | undefined =>
		index >= 0 && index < bytes.length
			? String.fromCharCode(bytes[index])
			: undefined;

	const emitInline = (start: number, end: number, beforeBlock = false) => {
		let from = start;
		let to = end;
		if (lastWasBlock && from < to && bytes[from] === 0x0a) from++;
		if (beforeBlock && to > from && bytes[to - 1] === 0x0a) to--;
		if (from < to) result.push(...inline(from, to));
	};

	for (let index = 0; index < blockFacets.length; ) {
		const blockFacet = blockFacets[index];
		const byteStart = Math.max(blockFacet.index.byteStart, rangeStart, cursor);
		const byteEnd = Math.min(blockFacet.index.byteEnd, rangeEnd);

		if (byteEnd <= byteStart) {
			index++;
			continue;
		}

		if (byteStart > cursor) {
			emitInline(cursor, byteStart, true);
			lastWasBlock = false;
		}

		if (isQuoteFacet(blockFacet)) {
			const children: Array<ColibriRichTextFacet> = [];
			const inner = withoutQuote(blockFacet);
			if (inner.features.some(isBlockFeature)) children.push(inner);
			let next = index + 1;
			while (
				next < blockFacets.length &&
				blockFacets[next].index.byteStart < byteEnd
			) {
				children.push(blockFacets[next]);
				next++;
			}
			result.push(
				<blockquote
					data-facet-type="quote"
					class="my-1 block border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground"
				>
					{renderBlockRange(bytes, byteStart, byteEnd, children, inline, ctx)}
				</blockquote>,
			);
			cursor = byteEnd;
			lastWasBlock = true;
			index = next;
			continue;
		}

		if (listFeatureOf(blockFacet)) {
			const items: Array<ColibriRichTextFacet> = [blockFacet];
			let previousEnd = byteEnd;
			let next = index + 1;
			while (next < blockFacets.length) {
				const candidate = blockFacets[next];
				if (!listFeatureOf(candidate)) break;
				if (candidate.index.byteEnd > rangeEnd) break;
				if (candidate.index.byteStart < previousEnd) break;
				if (!isSingleLineGap(byteAt, previousEnd, candidate.index.byteStart)) {
					break;
				}
				items.push(candidate);
				previousEnd = candidate.index.byteEnd;
				next++;
			}
			result.push(...renderList(items, byteAt, inline));
			cursor = previousEnd;
			lastWasBlock = true;
			index = next;
			continue;
		}

		const codeblock = blockFacet.features.find(
			(feature) => kindOf(feature) === "codeblock",
		);
		const heading = blockFacet.features.find(
			(feature) => kindOf(feature) === "heading",
		);
		const subtext = blockFacet.features.find(
			(feature) => kindOf(feature) === "subtext",
		);

		if (codeblock) {
			const lang = stringField(codeblock, "lang") || undefined;
			result.push(
				<CodeBlock
					lang={lang}
					code={decoder.decode(bytes.subarray(byteStart, byteEnd))}
					highlight={ctx.highlight}
				/>,
			);
		} else if (heading) {
			const level = Math.min(
				Math.max(Number(field(heading, "level")) || 1, 1),
				3,
			);
			const content = inline(byteStart, byteEnd);
			result.push(
				level === 1 ? (
					<h1 data-facet-type="heading" class={HEADING_CLASS[1]}>
						{content}
					</h1>
				) : level === 2 ? (
					<h2 data-facet-type="heading" class={HEADING_CLASS[2]}>
						{content}
					</h2>
				) : (
					<h3 data-facet-type="heading" class={HEADING_CLASS[3]}>
						{content}
					</h3>
				),
			);
		} else if (subtext) {
			result.push(
				<span
					data-facet-type="subtext"
					class="block text-xs leading-4 text-muted-foreground"
				>
					{inline(byteStart, byteEnd)}
				</span>,
			);
		} else {
			emitInline(byteStart, byteEnd);
		}

		cursor = byteEnd;
		lastWasBlock = true;
		index++;
	}

	if (cursor < rangeEnd) emitInline(cursor, rangeEnd);

	return result;
};

export const renderRichText = (
	input: TextWithFacets,
	ctx: RichTextResolvers,
): Array<JSX.Element> => {
	const normalized = normalizeWhitespace({
		text: input.text ?? "",
		facets: input.facets ?? [],
	});
	const bytes = encoder.encode(normalized.text);
	const facets = normalizeFacets(sanitizeFacets(bytes, normalized.facets));
	const inline = (start: number, end: number) =>
		renderInlineRange(bytes, start, end, facets, ctx);

	const blockFacets = facets
		.filter((facet) => facet.features.some(isBlockFeature))
		.sort(compareBlockFacets);

	if (blockFacets.length === 0) return inline(0, bytes.length);
	return renderBlockRange(bytes, 0, bytes.length, blockFacets, inline, ctx);
};

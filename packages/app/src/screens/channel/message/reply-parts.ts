import { collapseWhitespace } from "../../../data/adapters/facets";
import { summaryParts } from "../../../data/channel-summary";
import type { Facet } from "../../../data/types";

export type ReplyPartEmoji = { name: string; src: string; alt?: string };

export type ReplyPart = string | ReplyPartEmoji;

export type ReplyEmojiResolvers = {
	byFeature?: (
		feature: Facet["features"][number],
	) => ReplyPartEmoji | undefined;
	byName?: (name: string) => ReplyPartEmoji | undefined;
};

const SHORTCODE = /:([a-z0-9_]{2,32}):/g;

const shortcodeParts = (
	text: string,
	byName: ReplyEmojiResolvers["byName"],
): ReplyPart[] => {
	if (!byName || !text.includes(":")) return [text];
	const parts: ReplyPart[] = [];
	let cursor = 0;
	for (const match of text.matchAll(SHORTCODE)) {
		const emoji = byName(match[1] as string);
		if (!emoji) continue;
		if (match.index > cursor) parts.push(text.slice(cursor, match.index));
		parts.push(emoji);
		cursor = match.index + match[0].length;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts;
};

const truncateParts = (parts: ReplyPart[], max: number): ReplyPart[] => {
	const kept: ReplyPart[] = [];
	let remaining = max;
	for (const part of parts) {
		if (remaining <= 0) break;
		if (typeof part !== "string") {
			kept.push(part);
			remaining -= 1;
			continue;
		}
		const chars = Array.from(part);
		kept.push(chars.slice(0, remaining).join(""));
		remaining -= chars.length;
	}
	const last = kept.at(-1);
	if (typeof last === "string") kept[kept.length - 1] = last.trimEnd();
	kept.push("...");
	return kept;
};

const hasOverflow = (parts: ReplyPart[], max: number) =>
	parts.reduce(
		(total, part) =>
			total + (typeof part === "string" ? Array.from(part).length : 1),
		0,
	) > max;

export const replyParts = (
	text: string,
	facets: readonly Facet[] | undefined,
	resolvers: ReplyEmojiResolvers,
	max = 140,
): ReplyPart[] => {
	const body = collapseWhitespace(text, facets ? [...facets] : []);
	if (!body.text) return [];
	const byFeature = resolvers.byFeature;
	const faceted = byFeature
		? summaryParts<ReplyPartEmoji>(body, byFeature)
		: [body.text];
	const parts = faceted.flatMap((part) =>
		typeof part === "string" ? shortcodeParts(part, resolvers.byName) : [part],
	);
	return hasOverflow(parts, max) ? truncateParts(parts, max) : parts;
};

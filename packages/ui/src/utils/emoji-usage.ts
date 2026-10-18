export type EmojiUsage = { count: number; lastUsed: number };

export const DEFAULT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮"];

function isEmojiUsage(value: unknown): value is EmojiUsage {
	if (typeof value !== "object" || value === null) return false;
	const { count, lastUsed } = value as Record<string, unknown>;
	return (
		typeof count === "number" &&
		Number.isFinite(count) &&
		typeof lastUsed === "number" &&
		Number.isFinite(lastUsed)
	);
}

export function normalizeEmojiUsage(
	value: unknown,
): Record<string, EmojiUsage> {
	if (typeof value !== "object" || value === null) return {};
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).filter(
			([emoji, usage]) => emoji.length > 0 && isEmojiUsage(usage),
		),
	) as Record<string, EmojiUsage>;
}

function rankedEmoji(usage: Record<string, EmojiUsage>): string[] {
	return Object.entries(usage)
		.sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
		.map(([emoji]) => emoji);
}

export function pruneEmojiUsage(
	usage: Record<string, EmojiUsage>,
	max: number,
): Record<string, EmojiUsage> {
	const ranked = rankedEmoji(usage);
	if (ranked.length <= max) return usage;
	return Object.fromEntries(
		ranked.slice(0, max).map((emoji) => [emoji, usage[emoji]]),
	);
}

export function topEmoji(
	usage: Record<string, EmojiUsage>,
	limit: number,
): string[] {
	const ranked = rankedEmoji(usage).slice(0, limit);
	for (const fallback of DEFAULT_QUICK_REACTIONS) {
		if (ranked.length >= limit) break;
		if (!ranked.includes(fallback)) ranked.push(fallback);
	}
	return ranked;
}

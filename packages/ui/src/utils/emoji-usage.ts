export type EmojiUsage = { count: number; lastUsed: number };

export const DEFAULT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮"];

const EMOJI_USAGE_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

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

function emojiFrecency(usage: EmojiUsage, now: number): number {
	const age = Math.max(0, now - usage.lastUsed);

	return Math.log2(usage.count) - age / EMOJI_USAGE_HALF_LIFE_MS;
}

function rankedEmoji(usage: Record<string, EmojiUsage>, now: number): string[] {
	return Object.entries(usage)
		.map(([emoji, entry]) => ({
			emoji,
			score: emojiFrecency(entry, now),
			lastUsed: entry.lastUsed,
		}))
		.sort((a, b) => b.score - a.score || b.lastUsed - a.lastUsed)
		.map((entry) => entry.emoji);
}

export function pruneEmojiUsage(
	usage: Record<string, EmojiUsage>,
	max: number,
	now = Date.now(),
): Record<string, EmojiUsage> {
	const ranked = rankedEmoji(usage, now);
	if (ranked.length <= max) return usage;
	return Object.fromEntries(
		ranked.slice(0, max).map((emoji) => [emoji, usage[emoji]]),
	);
}

export function isCustomEmojiKey(key: string): boolean {
	return key.startsWith("at://");
}

export function topEmoji(
	usage: Record<string, EmojiUsage>,
	limit: number,
	resolveCustom?: (uri: string) => string | undefined,
	now = Date.now(),
): string[] {
	const ranked: string[] = [];
	for (const key of rankedEmoji(usage, now)) {
		if (ranked.length >= limit) break;
		const shown = isCustomEmojiKey(key) ? resolveCustom?.(key) : key;
		if (shown && !ranked.includes(shown)) ranked.push(shown);
	}
	for (const fallback of DEFAULT_QUICK_REACTIONS) {
		if (ranked.length >= limit) break;
		if (!ranked.includes(fallback)) ranked.push(fallback);
	}
	return ranked;
}

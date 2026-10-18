import type { CustomEmojiSuggestion } from "./types";

export const customEmojiAttrs = (emoji: CustomEmojiSuggestion) => ({
	id: emoji.id,
	label: emoji.fallback ?? `:${emoji.name}:`,
	handle: null,
	avatar: emoji.src,
	name: emoji.name,
	alt: emoji.alt ?? null,
	cid: emoji.cid ?? null,
	type: "customEmoji" as const,
});

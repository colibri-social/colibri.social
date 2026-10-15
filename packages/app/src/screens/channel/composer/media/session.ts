import type { EmojiUsage, Gif, SkinTone } from "@colibri-social/ui";
import type { PreferenceStore } from "../../../../data/preferences/store";
import { useData } from "../../../../data/store";
import type { GifView } from "../../../../data/types";

export const createMediaSession = (preferences: PreferenceStore) => ({
	usage: (): Record<string, EmojiUsage> => preferences.composer().emojiUsage,
	recordEmoji: (emoji: string) => preferences.recordEmoji(emoji),
	skinTone: () => preferences.composer().skinTone as SkinTone,
	setSkinTone: (tone: SkinTone) => preferences.setSkinTone(tone),
	recentGifs: (): Gif[] => preferences.composer().recentGifs,
	recordGif: (gif: Gif) => preferences.recordGif(gif as GifView),
});

export type MediaSession = ReturnType<typeof createMediaSession>;

export const mediaSession = () => createMediaSession(useData().preferences);

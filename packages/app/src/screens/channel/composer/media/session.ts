import type { EmojiUsage, Gif, SkinTone } from "@colibri-social/ui";
import { pruneEmojiUsage } from "@colibri-social/ui";
import { createRoot, createSignal } from "solid-js";

const MAX_USAGE = 64;
const MAX_RECENT_GIFS = 12;

const session = createRoot(() => {
	const [usage, setUsage] = createSignal<Record<string, EmojiUsage>>({});
	const [skinTone, setSkinTone] = createSignal<SkinTone>(0);
	const [recentGifs, setRecentGifs] = createSignal<Gif[]>([]);

	const recordEmoji = (emoji: string) =>
		setUsage((current) => {
			const previous = current[emoji];
			return pruneEmojiUsage(
				{
					...current,
					[emoji]: {
						count: (previous?.count ?? 0) + 1,
						lastUsed: Date.now(),
					},
				},
				MAX_USAGE,
			);
		});

	const recordGif = (gif: Gif) =>
		setRecentGifs((current) =>
			[gif, ...current.filter((entry) => entry.id !== gif.id)].slice(
				0,
				MAX_RECENT_GIFS,
			),
		);

	return {
		usage,
		recordEmoji,
		skinTone,
		setSkinTone,
		recentGifs,
		recordGif,
	};
});

export const mediaSession = () => session;

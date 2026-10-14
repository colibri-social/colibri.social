import type { GifView } from "../types";
import { asUri } from "./refs";

type GifSeed = {
	id: string;
	width: number;
	height: number;
	title: string;
	tags: string[];
};

const SEEDS: GifSeed[] = [
	{
		id: "JIX9t2j0ZTN9S",
		width: 480,
		height: 480,
		title: "Cat typing",
		tags: ["cat", "typing", "work", "busy"],
	},
	{
		id: "l0MYt5jPR6QX5pnqM",
		width: 480,
		height: 270,
		title: "Happy dance",
		tags: ["dance", "happy", "party", "yay"],
	},
	{
		id: "5VKbvrjxpVJCM",
		width: 400,
		height: 225,
		title: "Wow",
		tags: ["wow", "surprised", "omg"],
	},
	{
		id: "111ebonMs90YLu",
		width: 500,
		height: 281,
		title: "Thumbs up",
		tags: ["thumbs", "yes", "ok", "agree", "good"],
	},
	{
		id: "26tOZ42Mg6pbTUPHW",
		width: 480,
		height: 360,
		title: "Party time",
		tags: ["party", "celebrate", "yay", "confetti"],
	},
	{
		id: "3o7TKSjRrfIPjeiVyM",
		width: 480,
		height: 270,
		title: "Bird",
		tags: ["bird", "hummingbird", "colibri", "fly"],
	},
];

export const gifView = (seed: GifSeed): GifView => ({
	id: seed.id,
	url: asUri(`https://media.giphy.com/media/${seed.id}/giphy.gif`),
	previewUrl: asUri(`https://media.giphy.com/media/${seed.id}/200w.gif`),
	width: seed.width,
	height: seed.height,
	title: seed.title,
});

export const searchGifs = (query?: string): GifView[] => {
	const needle = query?.trim().toLowerCase();
	const matches = needle
		? SEEDS.filter(
				(seed) =>
					seed.title.toLowerCase().includes(needle) ||
					seed.tags.some((tag) => tag.startsWith(needle)),
			)
		: SEEDS;
	return matches.map(gifView);
};

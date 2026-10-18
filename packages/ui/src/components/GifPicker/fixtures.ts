import { paintImage } from "../Banner/story-images";
import type { Gif, GifCategory, GifPage, GifSource } from "./GifPicker";

const palette: [string, string][] = [
	["#8e51ff", "#5b21b6"],
	["#2dd4bf", "#0f766e"],
	["#fbbf24", "#c2410c"],
	["#f472b6", "#7c3aed"],
	["#60a5fa", "#1e3a8a"],
	["#a3e635", "#3f6212"],
];

const sizes: [number, number][] = [
	[200, 150],
	[200, 260],
	[200, 112],
	[200, 200],
	[200, 300],
	[200, 140],
];

export const fixtureGif = (index: number, prefix = "gif"): Gif => {
	const [width, height] = sizes[index % sizes.length];
	const src = paintImage(
		width / 2,
		height / 2,
		palette[index % palette.length],
	);
	return {
		id: `${prefix}-${index}`,
		url: src,
		previewUrl: src,
		width,
		height,
		title: `${prefix === "gif" ? "Trending" : prefix} GIF ${index + 1}`,
	};
};

export const fixtureGifs = (count: number, offset = 0, prefix = "gif") =>
	Array.from({ length: count }, (_, index) =>
		fixtureGif(index + offset, prefix),
	);

export const fixtureCategories: GifCategory[] = [
	"happy",
	"thumbs up",
	"excited",
	"sad",
	"dance",
	"wow",
].map((name, index) => ({
	name,
	previewUrl: paintImage(80, 40, palette[index % palette.length]),
}));

export type FakeGifSourceOptions = {
	delay?: number;
	pages?: number;
	pageSize?: number;
	fail?: { trending?: boolean; search?: boolean; categories?: boolean };
	searchDelay?: (query: string) => number;
};

const wait = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export const createFakeGifSource = (
	options: FakeGifSourceOptions = {},
): GifSource & { calls: string[] } => {
	const calls: string[] = [];
	const pageSize = options.pageSize ?? 12;
	const pages = options.pages ?? 3;
	const page = (prefix: string, cursor?: string): GifPage => {
		const index = cursor ? Number(cursor) : 0;
		return {
			gifs: fixtureGifs(pageSize, index * pageSize, prefix),
			cursor: index + 1 < pages ? String(index + 1) : undefined,
		};
	};
	return {
		calls,
		trending: async (cursor) => {
			calls.push(`trending:${cursor ?? ""}`);
			await wait(options.delay ?? 300);
			if (options.fail?.trending) throw new Error("trending failed");
			return page("gif", cursor);
		},
		search: async (query, cursor) => {
			calls.push(`search:${query}:${cursor ?? ""}`);
			await wait(options.searchDelay?.(query) ?? options.delay ?? 300);
			if (options.fail?.search) throw new Error("search failed");
			return page(query, cursor);
		},
		categories: async () => {
			calls.push("categories");
			await wait(options.delay ?? 300);
			if (options.fail?.categories) throw new Error("categories failed");
			return fixtureCategories;
		},
	};
};

import { describe, expect, it, vi } from "vitest";
import type { GifView } from "../../../../data/types";
import { createGifSource, type GifData } from "./gif-source";

const gif = (id: string) => {
	return {
		id,
		url: `https://cdn.test/${id}.gif`,
		previewUrl: `https://cdn.test/${id}-sm.gif`,
		width: 200,
		height: 150,
	} as GifView;
};

const fakeData = (listGifs: GifData["listGifs"]): GifData => {
	return {
		listGifs: vi.fn(listGifs),
		listGifCategories: vi.fn(async () => [
			{ name: "Party", previewUrl: "https://cdn.test/party-sm.gif" as const },
		]),
		gifFavorites: () => [],
		setGifFavorite: () => {},
	};
};

describe("createGifSource", () => {
	it("fetches trending once per session across picker opens", async () => {
		const data = fakeData(async () => [gif("a")]);

		const first = await createGifSource(data).trending();
		const second = await createGifSource(data).trending();

		expect(first.gifs.map((entry) => entry.id)).toEqual(["a"]);
		expect(second).toBe(first);
		expect(data.listGifs).toHaveBeenCalledTimes(1);
	});

	it("loads categories only when asked, then reuses them", async () => {
		const data = fakeData(async (query) => [gif(query ?? "trending")]);
		const source = createGifSource(data);

		expect(data.listGifCategories).not.toHaveBeenCalled();

		const first = await source.categories();
		const second = await createGifSource(data).categories();

		expect(first.map((entry) => entry.name)).toEqual(["Party"]);
		expect(second).toBe(first);
		expect(data.listGifCategories).toHaveBeenCalledTimes(1);
		expect(data.listGifs).not.toHaveBeenCalled();
	});

	it("retries after a failed load", async () => {
		let fail = true;
		const data = fakeData(async () => {
			if (fail) throw new Error("upstream");
			return [gif("a")];
		});
		const source = createGifSource(data);

		await expect(source.trending()).rejects.toThrow("upstream");

		fail = false;

		await expect(source.trending()).resolves.toEqual({ gifs: [gif("a")] });
	});

	it("keeps searches uncached", async () => {
		const data = fakeData(async () => [gif("a")]);
		const source = createGifSource(data);

		await source.search("cat");
		await source.search("cat");

		expect(data.listGifs).toHaveBeenCalledTimes(2);
	});
});

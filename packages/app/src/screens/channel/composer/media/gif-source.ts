import type { GifCategory, GifPage, GifSource } from "@colibri-social/ui";
import type { DataSource } from "../../../../data/source";

export type GifData = Pick<
	DataSource,
	"listGifs" | "gifFavorites" | "setGifFavorite"
>;

const CATEGORY_NAMES = ["Happy", "Party", "Wow", "Thumbs up", "Cat", "Bird"];

export const createGifSource = (data: GifData): GifSource => ({
	trending: async (): Promise<GifPage> => ({ gifs: await data.listGifs() }),
	search: async (query): Promise<GifPage> => ({
		gifs: await data.listGifs(query),
	}),
	categories: async (): Promise<GifCategory[]> => {
		const results = await Promise.all(
			CATEGORY_NAMES.map(async (name): Promise<GifCategory | undefined> => {
				const [first] = await data.listGifs(name);
				return first ? { name, previewUrl: first.previewUrl } : undefined;
			}),
		);
		return results.filter((entry): entry is GifCategory => !!entry);
	},
});

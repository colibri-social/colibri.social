import type { GifCategory, GifPage, GifSource } from "@colibri-social/ui";
import type { DataSource } from "../../../../data/source";

export type GifData = Pick<
	DataSource,
	"listGifs" | "listGifCategories" | "gifFavorites" | "setGifFavorite"
>;

type SessionCache = {
	trending?: Promise<GifPage>;
	categories?: Promise<GifCategory[]>;
};

const sessions = new WeakMap<GifData, SessionCache>();

const sessionOf = (data: GifData) => {
	const existing = sessions.get(data);

	if (existing) return existing;

	const created: SessionCache = {};

	sessions.set(data, created);

	return created;
};

const remember = <K extends keyof SessionCache>(
	cache: SessionCache,
	key: K,
	load: () => NonNullable<SessionCache[K]>,
): NonNullable<SessionCache[K]> => {
	const cached = cache[key];

	if (cached) return cached as NonNullable<SessionCache[K]>;

	const pending = load();

	cache[key] = pending;
	pending.catch(() => {
		if (cache[key] === pending) cache[key] = undefined;
	});

	return pending;
};

export const createGifSource = (data: GifData): GifSource => {
	const cache = sessionOf(data);

	return {
		trending: () => {
			return remember(cache, "trending", () =>
				data.listGifs().then((gifs) => ({ gifs })),
			);
		},
		search: async (query): Promise<GifPage> => ({
			gifs: await data.listGifs(query),
		}),
		categories: () => {
			return remember(cache, "categories", () => data.listGifCategories());
		},
	};
};

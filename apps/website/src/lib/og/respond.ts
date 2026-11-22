import { cachedRender, pngResponse, renderOg } from "./render";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const TTL = {
	static: { cache: DAY * 1000, header: DAY },
	content: { cache: HOUR * 1000, header: HOUR },
	live: { cache: 10 * 60 * 1000, header: 10 * 60 },
} as const;

export const respondOg = async (
	key: string,
	ttl: (typeof TTL)[keyof typeof TTL],
	markup: () => Promise<string | null>,
	fallback: () => string,
): Promise<Response> => {
	try {
		const png = await cachedRender(key, ttl.cache, async () => {
			const built = await markup();
			return renderOg(built ?? fallback());
		});
		return pngResponse(png, ttl.header);
	} catch {
		try {
			const png = await cachedRender(`fallback:${key}`, TTL.live.cache, () =>
				renderOg(fallback()),
			);
			return pngResponse(png, TTL.live.header);
		} catch {
			return new Response(null, { status: 404 });
		}
	}
};

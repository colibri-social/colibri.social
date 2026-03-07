import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import ogs from "open-graph-scraper";
import type { ImageObject, OgObject } from "open-graph-scraper/types";
import { generateHash } from "@/utils/generate-hash";
import { getRedisClient } from "@/utils/redis";

const cacheKey = async (uri: string) => {
	const hash = await generateHash(uri);
	return `cache:opengraph:${hash}`;
};

type OgReturnData = OgObject & { themeColor: string | undefined };

const getOpenGraphData = async (
	uri: string,
): Promise<OgReturnData | undefined> => {
	const { error, html, result } = await ogs({
		url: uri,
		customMetaTags: [
			{ fieldName: "theme-color", property: "themeColor", multiple: false },
		],
	});

	if (error) return undefined;

	const themeColorRes =
		/<meta\s+name="theme-color"\s+content="(#[\w\d]+)"/.exec(html);

	const themeColor = themeColorRes ? themeColorRes[1] : undefined;

	return { ...result, themeColor } as OgReturnData;
};

type TwitterCardStyle = "summary_card" | "summary_large_image";

interface DisplayableOpenGraphData {
	siteName?: string;
	title?: string;
	description?: string;
	image?: ImageObject[];
	cardStyle?: TwitterCardStyle;
	themeColor?: string;
}

const consolidateOpenGraphInfo = (
	info: OgReturnData,
): DisplayableOpenGraphData => {
	return {
		siteName: info.ogSiteName,
		title: info.ogTitle || info.twitterTitle,
		description: info.ogDescription || info.twitterDescription,
		image: info.ogImage || info.twitterImage,
		cardStyle: info.twitterCard as TwitterCardStyle | undefined,
		themeColor: info.themeColor as string | undefined,
	};
};

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days

export const getEmbedDataForURI = defineAction({
	input: z.object({
		uri: z.string().url(),
	}),
	handler: async ({ uri }, { session }) => {
		try {
			if (!session || !session?.has("user")) {
				throw new ActionError({
					message: "Forbidden",
					code: "FORBIDDEN",
				});
			}

			const key = await cacheKey(uri);

			const redis = await getRedisClient();
			const raw = await redis.get(key);

			if (raw) return JSON.parse(raw) as DisplayableOpenGraphData;

			const openGraphData = await getOpenGraphData(uri);

			if (!openGraphData) {
				throw new ActionError({
					message: "No OpenGraph info found.",
					code: "NOT_FOUND",
				});
			}

			const data = consolidateOpenGraphInfo(openGraphData);

			await redis.set(key, JSON.stringify(data), {
				EX: CACHE_TTL_SECONDS,
			});

			return data;
		} catch (e) {
			console.error(e);

			throw new ActionError({
				message: (e as Error).message,
				code: "INTERNAL_SERVER_ERROR",
			});
		}
	},
});

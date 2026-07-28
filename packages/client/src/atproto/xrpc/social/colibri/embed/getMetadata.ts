import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type EmbedMetadata = {
	title?: string;
	description?: string;
	siteName?: string;
	themeColor?: string;
	image?: Array<{ url: string; alt?: string }>;
	/** Large (`summary_large_image`) vs small thumbnail (`summary`) layout. */
	largeImage?: boolean;
};

export const getMetadata: XrpcRequest<
	[string],
	Promise<EmbedMetadata | undefined>
> = async (fetch, uri) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.embed.getMetadata?uri=${encodeURIComponent(uri)}`,
		);

		if (!res.ok) return undefined;

		return await readJson<EmbedMetadata>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

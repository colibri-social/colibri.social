import type { XrpcRequest } from "../../..";

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
	[string, string],
	Promise<EmbedMetadata | undefined>
> = async (fetch, uri, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.embed.getMetadata?uri=${encodeURIComponent(uri)}&auth=${auth}`,
		);

		if (!res.ok) return undefined;

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

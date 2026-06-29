import type { XrpcRequest } from "../../..";
import type { GifPage } from "./gifTypes";

export const searchGifs: XrpcRequest<
	[string, number?],
	Promise<GifPage | undefined>
> = async (fetch, query, page) => {
	try {
		const params = new URLSearchParams({ q: query });
		if (page !== undefined) params.set("page", String(page));

		const res = await fetch(
			`/xrpc/social.colibri.embed.searchGifs?${params.toString()}`,
		);

		if (!res.ok) return undefined;

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

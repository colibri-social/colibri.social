import type { XrpcRequest } from "../../..";
import type { GifCategory } from "./gifTypes";

export const gifCategories: XrpcRequest<
	[],
	Promise<Array<GifCategory> | undefined>
> = async (fetch) => {
	try {
		const res = await fetch("/xrpc/social.colibri.embed.gifCategories");

		if (!res.ok) return undefined;

		const data: { categories?: Array<GifCategory> } = await res.json();
		return data.categories ?? [];
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

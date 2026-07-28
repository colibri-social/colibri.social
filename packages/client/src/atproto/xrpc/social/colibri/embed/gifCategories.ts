import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";
import type { GifCategory } from "./gifTypes";

export const gifCategories: XrpcRequest<
	[],
	Promise<Array<GifCategory> | undefined>
> = async (fetch) => {
	try {
		const res = await fetch("/xrpc/social.colibri.embed.gifCategories");

		const data = await readJson<{ categories?: Array<GifCategory> }>(res);
		if (!data) return undefined;

		return data.categories ?? [];
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

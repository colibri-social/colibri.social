import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";
import type { GifPage } from "./gifTypes";

export const trendingGifs: XrpcRequest<
	[number?],
	Promise<GifPage | undefined>
> = async (fetch, page) => {
	try {
		const params = new URLSearchParams();
		if (page !== undefined) params.set("page", String(page));
		const qs = params.toString();

		const res = await fetch(
			`/xrpc/social.colibri.embed.trendingGifs${qs ? `?${qs}` : ""}`,
		);

		if (!res.ok) return undefined;

		return await readJson<GifPage>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

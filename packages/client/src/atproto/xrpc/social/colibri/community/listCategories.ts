import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type Category = {
	uri: string;
	name: string;
	channelOrder: Array<string>;
};

type Response = {
	categories: Array<Category>;
};

export const listCategories: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listCategories?community=${community}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

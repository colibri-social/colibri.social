import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, name) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.category.create?community=${encodeURIComponent(community)}&name=${encodeURIComponent(name)}`,
			{ method: "POST" },
		);
		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	community: string;
};

export const dismissApplication: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, did) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.dismissApplication?community=${encodeURIComponent(community)}&did=${encodeURIComponent(did)}`,
			{ method: "POST" },
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

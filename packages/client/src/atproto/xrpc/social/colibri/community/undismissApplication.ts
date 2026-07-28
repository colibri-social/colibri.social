import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	community: string;
};

export const undismissApplication: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, did) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.undismissApplication?community=${encodeURIComponent(community)}&did=${encodeURIComponent(did)}`,
			{ method: "POST" },
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

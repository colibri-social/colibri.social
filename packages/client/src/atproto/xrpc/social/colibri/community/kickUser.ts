import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	handle: string;
};

export const kickUser: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.kickUser?community=${encodeURIComponent(community)}&identifier=${encodeURIComponent(identifier)}`,
			{ method: "POST" },
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

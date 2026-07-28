import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	handle: string;
};

export const banUser: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.banUser?community=${community}&identifier=${identifier}`,
			{
				method: "POST",
			},
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

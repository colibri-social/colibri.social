import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	source: string;
};

export const registerCredentials: XrpcRequest<
	[string, string, string, string],
	Promise<Response | undefined>
> = async (fetch, did, pds, identifier, password) => {
	try {
		const params = new URLSearchParams({ did, pds, identifier, password });

		const res = await fetch(
			`/xrpc/social.colibri.community.registerCredentials?${params.toString()}`,
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

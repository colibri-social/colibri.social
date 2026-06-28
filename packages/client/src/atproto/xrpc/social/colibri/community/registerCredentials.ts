import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	source: string;
};

export const registerCredentials: XrpcRequest<
	[string, string, string, string],
	Promise<Response | undefined>
> = async (fetch, did, pds, identifier, password) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.registerCredentials?did=${did}&pds=${pds}&identifier=${identifier}&password=${password}`,
			{
				method: "POST",
			},
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

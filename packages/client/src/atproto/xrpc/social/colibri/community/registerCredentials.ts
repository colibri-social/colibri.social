import { XrpcRequest } from "../../..";

type Response = {
	did: string;
	source: string;
};

export const registerCredentials: XrpcRequest<
	[string, string, string, string, string],
	Promise<Response | undefined>
> = async (fetch, did, pds, identifier, password, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.registerCredentials?did=${did}&pds=${pds}&identifier=${identifier}&password=${password}&auth=${auth}`,
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

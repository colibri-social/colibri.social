import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	handle: string;
};

export const unbanUser: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.unbanUser?community=${community}&identifier=${identifier}&auth=${auth}`,
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

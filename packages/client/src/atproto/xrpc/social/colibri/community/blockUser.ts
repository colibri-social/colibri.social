import { XrpcRequest } from "../../..";

type Response = {
	did: string;
	handle: string;
};

export const blockUser: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.blockUser?community=${community}&identifier=${identifier}&auth=${auth}`,
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

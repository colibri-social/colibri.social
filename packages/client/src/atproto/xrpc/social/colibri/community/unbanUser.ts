import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	handle: string;
};

export const unbanUser: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.unbanUser?community=${community}&identifier=${identifier}`,
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

import { XrpcRequest } from "../../..";

type Response = {
	code: string;
	community: string;
	createdBy: string;
	active: boolean;
};

export const createInvitation: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.createInvitation?community=${community}&auth=${auth}`,
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

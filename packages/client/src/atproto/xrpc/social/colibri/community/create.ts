import { XrpcRequest } from "../../..";

type Response = {
	did: string;
	community: string;
	category: string;
	channel: string;
	ownerRole: string;
	member: string;
};

export const create: XrpcRequest<
	[
		string,
		string | undefined,
		boolean,
		string,
		string | undefined,
		string | undefined,
	],
	Promise<Response | undefined>
> = async (
	fetch,
	name,
	description,
	requiresApproval,
	auth,
	picture,
	mimeType,
) => {
	try {
		const createRes = await fetch(
			`/xrpc/social.colibri.community.create?name=${name}&description=${description}&requires_approval_to_join=${requiresApproval}&auth=${auth}&picture=${picture}&mimeType=${mimeType}`,
			{
				method: "POST",
			},
		);

		return createRes.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

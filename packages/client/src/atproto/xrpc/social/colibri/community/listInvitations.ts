import { XrpcRequest } from "../../..";

type Invitation = {
	code: string;
	community: string;
	createdBy: string;
	active: boolean;
};

type Response = {
	codes: Array<Invitation>;
};

export const listInvitations: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, uri, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listInvitations?uri=${uri}&auth=${auth}`,
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

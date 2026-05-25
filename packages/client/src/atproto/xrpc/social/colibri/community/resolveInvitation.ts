import { XrpcRequest } from "../../..";

type Response = {
	code: string;
	community: string;
	createdBy: string;
	active: boolean;
};

export const resolveInvitation: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, code, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.resolveInvitation?code=${code}&auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

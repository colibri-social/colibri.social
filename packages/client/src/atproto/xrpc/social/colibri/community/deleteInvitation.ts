import { XrpcRequest } from "../../..";

type Response = {
	code: string;
};

export const deleteInvitation: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, uri, code, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.deleteInvitation?uri=${uri}&code=${code}&auth=${auth}`,
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

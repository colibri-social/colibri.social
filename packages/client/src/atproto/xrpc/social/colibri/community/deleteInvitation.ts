import type { XrpcRequest } from "../../..";

type Response = {
	code: string;
};

export const deleteInvitation: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, uri, code) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.deleteInvitation?uri=${uri}&code=${code}`,
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

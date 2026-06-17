import type { XrpcRequest } from "../../..";

type Response = {
	code: string;
	community: string;
	createdBy: string;
	active: boolean;
};

export const getInvitation: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, code) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.getInvitation?code=${encodeURIComponent(code)}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

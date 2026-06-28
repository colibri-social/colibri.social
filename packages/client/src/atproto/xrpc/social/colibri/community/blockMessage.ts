import type { XrpcRequest } from "../../..";

type Response = {
	message: string;
};

export const blockMessage: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, message) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.blockMessage?community=${community}&message=${message}`,
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

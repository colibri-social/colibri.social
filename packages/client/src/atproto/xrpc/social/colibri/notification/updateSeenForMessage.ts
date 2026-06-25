import type { XrpcRequest } from "../../..";

type Response = {
	updated: number;
};

export const updateSeenForMessage: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, message, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.updateSeenForMessage?message=${message}&auth=${auth}`,
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

import type { XrpcRequest } from "../../..";

type Response = {
	updated: number;
};

export const updateSeenForMessage: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, message) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.updateSeenForMessage?message=${message}`,
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

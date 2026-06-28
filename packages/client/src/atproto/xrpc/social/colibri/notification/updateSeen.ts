import type { XrpcRequest } from "../../..";

type Response = {
	updated: number;
};

export const updateSeen: XrpcRequest<
	[string | undefined],
	Promise<Response | undefined>
> = async (fetch, seenAt) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.updateSeen?seenAt=${seenAt}`,
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

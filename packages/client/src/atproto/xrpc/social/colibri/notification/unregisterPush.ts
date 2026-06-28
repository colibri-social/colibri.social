import type { XrpcRequest } from "../../..";

type Response = {
	unregistered: boolean;
};

export const unregisterPush: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, endpoint) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.unregisterPush`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ endpoint }),
			},
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

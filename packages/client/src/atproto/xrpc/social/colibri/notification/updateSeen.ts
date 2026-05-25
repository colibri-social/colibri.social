import { XrpcRequest } from "../../..";

type Response = {
	updated: number;
};

export const updateSeen: XrpcRequest<
	[string | undefined, string],
	Promise<Response | undefined>
> = async (fetch, seenAt, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.updateSeen?seenAt=${seenAt}&auth=${auth}`,
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

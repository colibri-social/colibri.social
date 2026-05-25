import { XrpcRequest } from "../../..";

type Response = {
	count: number;
};

export const getUnreadCount: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.getUnreadCount?auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

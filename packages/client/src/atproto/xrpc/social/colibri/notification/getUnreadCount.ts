import type { XrpcRequest } from "../../..";

type Response = {
	count: number;
};

export const getUnreadCount: XrpcRequest<
	[],
	Promise<Response | undefined>
> = async (fetch) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.getUnreadCount`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

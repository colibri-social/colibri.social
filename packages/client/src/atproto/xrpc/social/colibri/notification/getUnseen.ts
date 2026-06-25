import type { XrpcRequest } from "../../..";

export type UnseenNotification = {
	id: number;
	messageUri: string;
	indexedAt: string;
};

type Response = {
	notifications: UnseenNotification[];
};

export const getUnseen: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, channel, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.getUnseen?channel=${channel}&auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

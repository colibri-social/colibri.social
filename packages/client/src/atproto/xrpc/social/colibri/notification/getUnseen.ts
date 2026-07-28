import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type UnseenNotification = {
	id: number;
	kind: "mention" | "reply" | "message";
	messageUri: string;
	indexedAt: string;
};

type Response = {
	notifications: UnseenNotification[];
};

export const getUnseen: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, channel) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.getUnseen?channel=${channel}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

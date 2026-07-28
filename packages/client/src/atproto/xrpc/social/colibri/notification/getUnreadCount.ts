import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	count: number;
};

export const getUnreadCount: XrpcRequest<
	[],
	Promise<Response | undefined>
> = async (fetch) => {
	try {
		const res = await fetch(`/xrpc/social.colibri.notification.getUnreadCount`);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

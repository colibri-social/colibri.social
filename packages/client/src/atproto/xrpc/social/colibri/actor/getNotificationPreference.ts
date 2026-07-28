import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type NotificationLevel = "all" | "mentionsAndReplies";

type Response = {
	level: NotificationLevel;
};

export const getNotificationPreference: XrpcRequest<
	[],
	Promise<Response | undefined>
> = async (fetch) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.actor.getNotificationPreference`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

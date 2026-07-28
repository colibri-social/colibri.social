import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	updated: number;
	clearedPings: number;
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

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

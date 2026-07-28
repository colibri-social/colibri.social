import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Reaction = {
	emoji: string;
	count: number;
	reactorDIDs: Array<string>;
};

type Response = {
	reactions: Array<Reaction>;
};

export const listReactions: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, message) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.listReactions?message=${encodeURIComponent(message)}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

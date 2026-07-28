import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	uri: string;
	value: Record<string, unknown>;
};

export const getRecord: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, repo, collection, rkey) => {
	try {
		const res = await fetch(
			`/xrpc/com.atproto.sync.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

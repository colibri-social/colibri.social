import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
};

export const resolveHandle: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, handle) => {
	try {
		const res = await fetch(
			`/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

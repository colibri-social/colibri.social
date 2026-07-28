import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	handle: string;
	didDoc: unknown;
};

export const resolveIdentity: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, identifier) => {
	try {
		const res = await fetch(
			`/xrpc/com.atproto.identity.resolveIdentity?identifier=${identifier}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

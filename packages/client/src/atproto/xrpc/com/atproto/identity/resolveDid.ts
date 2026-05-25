import { XrpcRequest } from "../../..";

type Response = {
	didDoc: unknown;
};

export const resolveDid: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, did) => {
	try {
		const res = await fetch(
			`/xrpc/com.atproto.identity.resolveDid?did=${did}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

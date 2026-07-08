import type { XrpcRequest } from "../../..";

// Our appview and the PDS have a mismatch here, the AppView needs to be updated
type Response = {
	data?: {
		alsoKnownAs: Array<string>;
	};
	alsoKnownAs?: Array<string>;
};

export const resolveDid: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, did) => {
	try {
		const res = await fetch(`/xrpc/com.atproto.identity.resolveDid?did=${did}`);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

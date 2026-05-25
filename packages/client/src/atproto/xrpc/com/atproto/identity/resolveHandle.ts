import { XrpcRequest } from "../../..";

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

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

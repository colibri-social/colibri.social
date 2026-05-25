import { XrpcRequest } from "../../..";

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

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

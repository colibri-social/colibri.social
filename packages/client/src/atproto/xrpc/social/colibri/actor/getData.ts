import type { ActorData } from "lib";
import { XrpcRequest } from "../../..";

export const getData: XrpcRequest<
	[string],
	Promise<ActorData | undefined>
> = async (fetch, identifier) => {
	try {
		const getDataRes = await fetch(
			`/xrpc/social.colibri.actor.getData?identifier=${identifier}`,
		);

		return getDataRes.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

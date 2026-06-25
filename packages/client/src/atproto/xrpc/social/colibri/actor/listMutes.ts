import type { XrpcRequest } from "../../..";

export type Mute = {
	uri: string;
	subject: string;
};

type Response = {
	mutes: Mute[];
};

export const listMutes: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.actor.listMutes?auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

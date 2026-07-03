import type { XrpcRequest } from "../../..";

export type Mute = {
	uri: string;
	subject: string;
};

type Response = {
	mutes: Mute[];
};

export const listMutes: XrpcRequest<[], Promise<Response | undefined>> = async (
	fetch,
) => {
	try {
		const res = await fetch(`/xrpc/social.colibri.actor.listMutes`);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

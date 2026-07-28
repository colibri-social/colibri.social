import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

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

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

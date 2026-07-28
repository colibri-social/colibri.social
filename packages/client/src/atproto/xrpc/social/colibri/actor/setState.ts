import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	onlineState: string;
};

export const setState: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, state) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.actor.setState?state=${state}`,
			{
				method: "POST",
			},
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

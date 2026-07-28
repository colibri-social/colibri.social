import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	did: string;
	community: string;
	member?: string;
};

export const approveMembership: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, membership) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.approveMembership?membership=${encodeURIComponent(membership)}`,
			{ method: "POST" },
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

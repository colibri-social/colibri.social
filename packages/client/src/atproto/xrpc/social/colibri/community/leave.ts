import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export const leave: XrpcRequest<
	[string],
	Promise<Record<string, never> | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.leave?community=${encodeURIComponent(community)}`,
			{ method: "POST" },
		);
		return await readJson<Record<string, never>>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

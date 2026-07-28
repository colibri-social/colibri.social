import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export const kick: XrpcRequest<
	[string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, community, member) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.kick?community=${encodeURIComponent(community)}&member=${encodeURIComponent(member)}`,
			{ method: "POST" },
		);
		return await readJson<Record<string, never>>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

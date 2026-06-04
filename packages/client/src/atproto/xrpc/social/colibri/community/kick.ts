import { XrpcRequest } from "../../..";

export const kick: XrpcRequest<
	[string, string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, community, member, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.kick?community=${encodeURIComponent(community)}&member=${encodeURIComponent(member)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

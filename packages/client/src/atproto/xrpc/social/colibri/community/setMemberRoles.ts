import type { XrpcRequest } from "../../..";

export const setMemberRoles: XrpcRequest<
	[string, string, string[]],
	Promise<Record<string, never> | undefined>
> = async (fetch, community, member, roles) => {
	try {
		const params = new URLSearchParams({
			community,
			member,
		});
		roles.forEach((uri) => {
			params.append("roles", uri);
		});
		const res = await fetch(
			`/xrpc/social.colibri.community.setMemberRoles?${params.toString()}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

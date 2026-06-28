import type { XrpcRequest } from "../../..";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[string, string, string, string],
	Promise<Response | undefined>
> = async (fetch, community, category, name, type) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.create?community=${encodeURIComponent(community)}&category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

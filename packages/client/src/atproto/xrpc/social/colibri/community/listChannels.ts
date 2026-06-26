import type { XrpcRequest } from "../../..";

export type Channel = {
	uri: string;
	name: string;
	description?: string;
	type: string;
	category: string;
	ownerOnly?: boolean;
	allowedRoles?: string[];
	allowedMembers?: string[];
};

type Response = {
	channels: Array<Channel>;
};

export const listChannels: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listChannels?community=${community}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

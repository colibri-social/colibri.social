import type { XrpcRequest } from "../../..";
import type { Member } from "./listMembers";

type Response = {
	members: Array<Member>;
};

export const listBlockedUsers: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listBlockedUsers?community=${community}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

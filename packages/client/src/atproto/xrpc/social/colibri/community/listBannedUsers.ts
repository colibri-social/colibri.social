import type { XrpcRequest } from "../../..";
import type { Member } from "./listMembers";

type Response = {
	users: Array<Omit<Member, "roles">>;
};

export const listBannedUsers: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listBannedUsers?community=${community}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";
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

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

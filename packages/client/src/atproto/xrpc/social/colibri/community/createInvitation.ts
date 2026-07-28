import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";
import type { Invitation } from "./listInvitations";

export const createInvitation: XrpcRequest<
	[string],
	Promise<Invitation | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.createInvitation?community=${community}`,
			{
				method: "POST",
			},
		);

		return await readJson<Invitation>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

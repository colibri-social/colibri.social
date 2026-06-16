import type { XrpcRequest } from "../../..";
import type { Invitation } from "./listInvitations";

export const createInvitation: XrpcRequest<
	[string, string],
	Promise<Invitation | undefined>
> = async (fetch, community, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.createInvitation?community=${community}&auth=${auth}`,
			{
				method: "POST",
			},
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	community: string;
	category: string;
	channel: string;
	ownerRole: string;
	member: string;
};

/**
 * Credentials for a "bring your own PDS" community. When supplied, the AppView
 * bootstraps the community on the user's own PDS under the DID these resolve
 * to, rather than minting a fresh managed DID.
 */
type ByoCredentials = {
	pds: string;
	identifier: string;
	password: string;
};

export const create: XrpcRequest<
	[
		string,
		string | undefined,
		boolean,
		Blob | undefined,
		Blob | undefined,
		ByoCredentials | undefined,
	],
	Promise<XrpcResult<Response>>
> = async (
	fetch,
	name,
	description,
	requiresApproval,
	picture,
	banner,
	byo,
) => {
	const params = new URLSearchParams({ name });
	if (description !== undefined) params.set("description", description);
	params.set("requiresApprovalToJoin", `${requiresApproval}`);
	if (byo) {
		params.set("pds", byo.pds);
		params.set("identifier", byo.identifier);
		params.set("password", byo.password);
	}
	const formData = new FormData();
	if (picture !== undefined) formData.append("picture", picture);
	if (banner !== undefined) formData.append("banner", banner);

	return request<Response>(fetch, {
		lxm: "social.colibri.community.create",
		route: `/xrpc/social.colibri.community.create?${params.toString()}`,
		init: {
			method: "POST",
			body: formData,
		},
	});
};

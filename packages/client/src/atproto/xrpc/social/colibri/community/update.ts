import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		Blob | undefined,
		Blob | undefined,
		boolean,
		boolean | undefined,
		boolean | undefined,
	],
	Promise<XrpcResult<Record<string, never>>>
> = async (
	fetch,
	community,
	name,
	description,
	picture,
	banner,
	requiresApprovalToJoin,
	removePicture,
	removeBanner,
) => {
	const params = new URLSearchParams({ community });
	if (name !== undefined) params.set("name", name);
	if (description !== undefined) params.set("description", description);
	if (requiresApprovalToJoin !== undefined)
		params.set("requiresApprovalToJoin", `${requiresApprovalToJoin}`);
	if (removePicture) params.set("removePicture", "true");
	if (removeBanner) params.set("removeBanner", "true");
	const formData = new FormData();
	if (picture !== undefined) formData.append("picture", picture);
	if (banner !== undefined) formData.append("banner", banner);

	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.community.update",
		route: `/xrpc/social.colibri.community.update?${params.toString()}`,
		init: {
			method: "POST",
			body: formData,
		},
	});
};

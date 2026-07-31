import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[string, string, string, string, string[]?, string[]?],
	Promise<XrpcResult<Response>>
> = async (
	fetch,
	community,
	category,
	name,
	type,
	allowedRoles,
	allowedMembers,
) => {
	const params = new URLSearchParams({ community, category, name, type });
	for (const r of allowedRoles ?? []) params.append("allowedRoles", r);
	for (const m of allowedMembers ?? []) params.append("allowedMembers", m);

	return request<Response>(fetch, {
		lxm: "social.colibri.channel.create",
		route: `/xrpc/social.colibri.channel.create?${params.toString()}`,
		init: { method: "POST" },
	});
};

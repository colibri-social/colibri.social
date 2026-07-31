import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		boolean | undefined,
		string[] | undefined,
		boolean | undefined,
		string[] | undefined,
		boolean | undefined,
		string | undefined,
	],
	Promise<XrpcResult<Record<string, never>>>
> = async (
	fetch,
	channel,
	name,
	description,
	ownerOnly,
	allowedRoles,
	clearAllowedRoles,
	allowedMembers,
	clearAllowedMembers,
	category,
) => {
	const params = new URLSearchParams({ channel });
	if (name !== undefined) params.set("name", name);
	if (description !== undefined) params.set("description", description);
	if (category !== undefined) params.set("category", category);
	if (ownerOnly !== undefined) params.set("ownerOnly", String(ownerOnly));
	for (const r of allowedRoles ?? []) params.append("allowedRoles", r);
	if (clearAllowedRoles !== undefined)
		params.set("clearAllowedRoles", String(clearAllowedRoles));
	for (const m of allowedMembers ?? []) params.append("allowedMembers", m);
	if (clearAllowedMembers !== undefined)
		params.set("clearAllowedMembers", String(clearAllowedMembers));

	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.channel.update",
		route: `/xrpc/social.colibri.channel.update?${params.toString()}`,
		init: { method: "POST" },
	});
};

import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
};

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		string[],
		number | undefined,
		boolean | undefined,
		boolean | undefined,
	],
	Promise<XrpcResult<Response>>
> = async (
	fetch,
	role,
	name,
	color,
	permissions = [],
	position,
	hoisted,
	mentionable,
) => {
	const params = new URLSearchParams({ role });
	if (name !== undefined) params.set("name", name);
	if (color !== undefined) params.set("color", color);
	for (const p of permissions) {
		params.append("permissions", p);
	}
	if (position !== undefined) params.set("position", String(position));
	if (hoisted !== undefined) params.set("hoisted", String(hoisted));
	if (mentionable !== undefined) params.set("mentionable", String(mentionable));

	return request<Response>(fetch, {
		lxm: "social.colibri.role.update",
		route: `/xrpc/social.colibri.role.update?${params.toString()}`,
		init: {
			method: "POST",
		},
	});
};

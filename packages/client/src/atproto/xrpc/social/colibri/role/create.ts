import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[
		string,
		string,
		number,
		string[],
		string | undefined,
		boolean | undefined,
		boolean | undefined,
	],
	Promise<XrpcResult<Response>>
> = async (
	fetch,
	community,
	name,
	position,
	permissions = [],
	color,
	hoisted,
	mentionable,
) => {
	const params = new URLSearchParams({
		community,
		name,
		position: String(position),
	});
	for (const p of permissions) {
		params.append("permissions", p);
	}
	if (color !== undefined) params.set("color", color);
	if (hoisted !== undefined) params.set("hoisted", String(hoisted));
	if (mentionable !== undefined) params.set("mentionable", String(mentionable));

	return request<Response>(fetch, {
		lxm: "social.colibri.role.create",
		route: `/xrpc/social.colibri.role.create?${params.toString()}`,
		init: {
			method: "POST",
		},
	});
};

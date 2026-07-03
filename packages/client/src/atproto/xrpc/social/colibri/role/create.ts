import type { XrpcRequest } from "../../..";

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
	Promise<Response | undefined>
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
	try {
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
		if (mentionable !== undefined)
			params.set("mentionable", String(mentionable));

		const res = await fetch(
			`/xrpc/social.colibri.role.create?${params.toString()}`,
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

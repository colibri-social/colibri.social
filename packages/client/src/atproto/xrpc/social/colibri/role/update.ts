import type { XrpcRequest } from "../../..";

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
	Promise<Response | undefined>
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
	try {
		const params = new URLSearchParams({ role });
		if (name !== undefined) params.set("name", name);
		if (color !== undefined) params.set("color", color);
		for (const p of permissions) {
			params.append("permissions", p);
		}
		if (position !== undefined) params.set("position", String(position));
		if (hoisted !== undefined) params.set("hoisted", String(hoisted));
		if (mentionable !== undefined)
			params.set("mentionable", String(mentionable));

		const res = await fetch(
			`/xrpc/social.colibri.role.update?${params.toString()}`,
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

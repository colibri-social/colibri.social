import type { XrpcRequest } from "../../..";

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
		string,
	],
	Promise<Record<string, never> | undefined>
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
	auth,
) => {
	try {
		const params = new URLSearchParams({ channel, auth });
		if (name !== undefined) params.set("name", name);
		if (description !== undefined) params.set("description", description);
		if (ownerOnly !== undefined) params.set("ownerOnly", String(ownerOnly));
		for (const r of allowedRoles ?? []) params.append("allowedRoles", r);
		if (clearAllowedRoles !== undefined)
			params.set("clearAllowedRoles", String(clearAllowedRoles));
		for (const m of allowedMembers ?? []) params.append("allowedMembers", m);
		if (clearAllowedMembers !== undefined)
			params.set("clearAllowedMembers", String(clearAllowedMembers));

		const res = await fetch(
			`/xrpc/social.colibri.channel.update?${params.toString()}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

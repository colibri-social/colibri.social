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
) => {
	try {
		const params = new URLSearchParams({ channel });
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
		// A non-2xx (e.g. the admin guard rejecting an ownerOnly change) still
		// carries a JSON body, so callers checking the resolved value would treat
		// it as success. Surface the failure as `undefined` instead.
		if (!res.ok) return undefined;
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

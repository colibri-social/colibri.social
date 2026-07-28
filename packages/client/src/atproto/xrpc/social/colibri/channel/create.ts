import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[string, string, string, string, string[]?, string[]?],
	Promise<Response | undefined>
> = async (
	fetch,
	community,
	category,
	name,
	type,
	allowedRoles,
	allowedMembers,
) => {
	try {
		const params = new URLSearchParams({ community, category, name, type });
		for (const r of allowedRoles ?? []) params.append("allowedRoles", r);
		for (const m of allowedMembers ?? []) params.append("allowedMembers", m);

		const res = await fetch(
			`/xrpc/social.colibri.channel.create?${params.toString()}`,
			{ method: "POST" },
		);
		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

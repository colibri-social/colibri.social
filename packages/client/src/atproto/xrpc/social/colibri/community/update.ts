import type { XrpcRequest } from "../../..";

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		string | undefined,
		string | undefined,
		string,
	],
	Promise<Record<string, never> | undefined>
> = async (fetch, community, name, description, picture, mimeType, auth) => {
	try {
		const params = new URLSearchParams({ community, auth });
		if (name !== undefined) params.set("name", name);
		if (description !== undefined) params.set("description", description);
		if (picture !== undefined) params.set("picture", picture);
		if (mimeType !== undefined) params.set("mimeType", mimeType);
		const res = await fetch(
			`/xrpc/social.colibri.community.update?${params.toString()}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

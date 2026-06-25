import type { XrpcRequest } from "../../..";

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		Blob | undefined,
		string | undefined,
		boolean,
		string,
	],
	Promise<Record<string, never> | undefined>
> = async (
	fetch,
	community,
	name,
	description,
	picture,
	mimeType,
	requiresApprovalToJoin,
	auth,
) => {
	try {
		const params = new URLSearchParams({ community, auth });
		if (name !== undefined) params.set("name", name);
		if (description !== undefined) params.set("description", description);
		if (mimeType !== undefined) params.set("mimeType", mimeType);
		if (requiresApprovalToJoin !== undefined)
			params.set("requiresApprovalToJoin", `${requiresApprovalToJoin}`);
		const res = await fetch(
			`/xrpc/social.colibri.community.update?${params.toString()}`,
			{
				method: "POST",
				...(picture
					? {
							body: picture,
							headers: { "Content-Type": mimeType ?? picture.type },
						}
					: {}),
			},
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

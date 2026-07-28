import type { XrpcRequest } from "../../..";

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		Blob | undefined,
		Blob | undefined,
		boolean,
	],
	Promise<Record<string, never> | undefined>
> = async (
	fetch,
	community,
	name,
	description,
	picture,
	banner,
	requiresApprovalToJoin,
) => {
	try {
		const params = new URLSearchParams({ community });
		if (name !== undefined) params.set("name", name);
		if (description !== undefined) params.set("description", description);
		if (requiresApprovalToJoin !== undefined)
			params.set("requiresApprovalToJoin", `${requiresApprovalToJoin}`);
		const formData = new FormData();
		if (picture !== undefined) formData.append("picture", picture);
		if (banner !== undefined) formData.append("banner", banner);
		const res = await fetch(
			`/xrpc/social.colibri.community.update?${params.toString()}`,
			{
				method: "POST",
				body: formData,
			},
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

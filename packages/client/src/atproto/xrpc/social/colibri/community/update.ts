import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export const update: XrpcRequest<
	[
		string,
		string | undefined,
		string | undefined,
		Blob | undefined,
		Blob | undefined,
		boolean,
		boolean | undefined,
		boolean | undefined,
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
	removePicture,
	removeBanner,
) => {
	try {
		const params = new URLSearchParams({ community });
		if (name !== undefined) params.set("name", name);
		if (description !== undefined) params.set("description", description);
		if (requiresApprovalToJoin !== undefined)
			params.set("requiresApprovalToJoin", `${requiresApprovalToJoin}`);
		if (removePicture) params.set("removePicture", "true");
		if (removeBanner) params.set("removeBanner", "true");
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
		return await readJson<Record<string, never>>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

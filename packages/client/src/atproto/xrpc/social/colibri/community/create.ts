import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	community: string;
	category: string;
	channel: string;
	ownerRole: string;
	member: string;
};

export const create: XrpcRequest<
	[
		string,
		string | undefined,
		boolean,
		string,
		Blob | undefined,
		string | undefined,
	],
	Promise<Response | undefined>
> = async (
	fetch,
	name,
	description,
	requiresApproval,
	auth,
	picture,
	mimeType,
) => {
	try {
		const params = new URLSearchParams({ name, auth });
		if (description !== undefined) params.set("description", description);
		params.set("requiresApprovalToJoin", `${requiresApproval}`);
		if (mimeType !== undefined) params.set("mimeType", mimeType);

		const createRes = await fetch(
			`/xrpc/social.colibri.community.create?${params.toString()}`,
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

		return createRes.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

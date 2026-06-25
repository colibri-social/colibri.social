import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	community: string;
	category: string;
	channel: string;
	ownerRole: string;
	member: string;
};

/**
 * Credentials for a "bring your own PDS" community. When supplied, the AppView
 * bootstraps the community on the user's own PDS under the DID these resolve
 * to, rather than minting a fresh managed DID.
 */
type ByoCredentials = {
	pds: string;
	identifier: string;
	password: string;
};

export const create: XrpcRequest<
	[
		string,
		string | undefined,
		boolean,
		string,
		Blob | undefined,
		string | undefined,
		ByoCredentials | undefined,
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
	byo,
) => {
	try {
		const params = new URLSearchParams({ name, auth });
		if (description !== undefined) params.set("description", description);
		params.set("requiresApprovalToJoin", `${requiresApproval}`);
		if (mimeType !== undefined) params.set("mimeType", mimeType);
		if (byo) {
			params.set("pds", byo.pds);
			params.set("identifier", byo.identifier);
			params.set("password", byo.password);
		}

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

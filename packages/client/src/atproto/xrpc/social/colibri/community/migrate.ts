import type { XrpcRequest } from "../../..";

/**
 * The migration to run. Kept as an open discriminator so future migrations can
 * be added without a new endpoint.
 */
export type MigrationKind = "legacy-community";

type Response = {
	did: string;
	community: string;
	channelMap: { old: string; new: string }[];
};

/**
 * Credentials for a "bring your own PDS" migration target. When supplied, the
 * AppView provisions the new community on that DID's PDS instead of minting a
 * fresh managed DID.
 */
type ByoCredentials = {
	pds: string;
	identifier: string;
	password: string;
};

type Overrides = {
	name?: string;
	description?: string;
	requiresApprovalToJoin?: boolean;
};

export const migrate: XrpcRequest<
	[
		MigrationKind,
		string,
		Overrides | undefined,
		Blob | undefined,
		string | undefined,
		ByoCredentials | undefined,
	],
	Promise<Response | undefined>
> = async (fetch, kind, source, overrides, picture, mimeType, byo) => {
	try {
		const params = new URLSearchParams({ kind, source });
		if (overrides?.name !== undefined) params.set("name", overrides.name);
		if (overrides?.description !== undefined)
			params.set("description", overrides.description);
		if (overrides?.requiresApprovalToJoin !== undefined)
			params.set(
				"requiresApprovalToJoin",
				`${overrides.requiresApprovalToJoin}`,
			);
		if (mimeType !== undefined) params.set("mimeType", mimeType);
		if (byo) {
			params.set("pds", byo.pds);
			params.set("identifier", byo.identifier);
			params.set("password", byo.password);
		}

		const res = await fetch(
			`/xrpc/social.colibri.community.migrate?${params.toString()}`,
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

import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

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
		ByoCredentials | undefined,
	],
	Promise<Response | undefined>
> = async (fetch, kind, source, overrides, picture, byo) => {
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
		if (byo) {
			params.set("pds", byo.pds);
			params.set("identifier", byo.identifier);
			params.set("password", byo.password);
		}
		const formData = new FormData();
		if (picture !== undefined) formData.append("picture", picture);

		const res = await fetch(
			`/xrpc/social.colibri.community.migrate?${params.toString()}`,
			{
				method: "POST",
				body: formData,
			},
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

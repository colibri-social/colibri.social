import type { ActorData } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type Invitation = {
	code: string;
	community: string;
	createdBy: ActorData;
	active: boolean;
};

type Response = {
	codes: Array<Invitation>;
};

export const listInvitations: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, uri) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listInvitations?uri=${uri}`,
			{
				method: "POST",
			},
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

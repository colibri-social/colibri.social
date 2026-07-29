import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState, ProfileTheme } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export type Member = {
	did: string;
	handle: string;
	roles: Array<string>;
	vc?: string;
	vcMuted?: boolean;
	vcDeafened?: boolean;
	vcServerMuted?: boolean;
	vcServerDeafened?: boolean;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		isBot: boolean;
		onlineState: OnlineState;
		theme?: ProfileTheme;
		status?: {
			emoji?: string;
			text: string;
		};
	};
};

type Response = {
	members: Array<Member>;
};

export const listMembers: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listMembers?community=${community}`,
		);

		return await readJson<Response>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

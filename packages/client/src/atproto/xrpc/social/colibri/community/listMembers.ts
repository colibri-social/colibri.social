import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState } from "lib";
import { XrpcRequest } from "../../..";

export type Member = {
	did: string;
	handle: string;
	roles: Array<string>;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		onlineState: OnlineState;
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

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

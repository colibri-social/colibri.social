import type { JsonBlobRef } from "@atproto/lexicon";
import type { AT_URI } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";

type Response = {
	code: string;
	community: AT_URI<"social.colibri.community">;
	createdBy: string;
	active: boolean;
	name: string;
	picture?: JsonBlobRef;
	memberCount: number;
	onlineCount: number;
	requiresApprovalToJoin: boolean;
};

export const getInvitation: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, code) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.getInvitation?code=${encodeURIComponent(code)}`,
		);

		if (!res.ok) return undefined;

		return await res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

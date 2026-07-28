import type { JsonBlobRef } from "@atproto/lexicon";
import type { AT_URI } from "../../../atproto.js";

export type Community = {
	name: string;
	picture: JsonBlobRef;
	banner: JsonBlobRef;
	description: string;
	categoryOrder: Array<string>;
	uri: AT_URI<"social.colibri.community">;
	requiresApprovalToJoin: boolean;
	isOwner?: boolean;
	isLegacy?: boolean;
};

import { JsonBlobRef } from "@atproto/lexicon";
import { AT_URI } from "../../../atproto.js";

export type Community = {
	name: string;
	picture: JsonBlobRef;
	description: string;
	categoryOrder: Array<string>;
	uri: AT_URI<"social.colibri.community">;
	requiresApprovalToJoin: boolean;
};

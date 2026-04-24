import { JsonBlobRef } from "@atproto/lexicon";
import { OnlineState } from "../../../shared.js";

export type ActorData = {
	did: string;
	handle: string;
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

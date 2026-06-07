import type { JsonBlobRef } from "@atproto/lexicon";

export type OnlineState = "online" | "away" | "dnd" | "offline";

export type AttachmentObj = {
	blob: JsonBlobRef;
	name: string;
};

import type { MediaSource } from "../atproto/voice-frames";

export interface SyncGroupOwner {
	did: string;
	source: MediaSource;
}

export const syncGroupFor = (owner: SyncGroupOwner): string =>
	`${owner.did}|${owner.source === "screen" ? "screen" : "live"}`;

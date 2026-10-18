import type { VoiceMediaSource } from "@colibri-social/lib";

export interface SyncGroupOwner {
	did: string;
	source: VoiceMediaSource;
}

export const syncGroupFor = (owner: SyncGroupOwner): string =>
	`${owner.did}|${owner.source === "screen" ? "screen" : "live"}`;

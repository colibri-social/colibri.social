import type { VoiceParticipant, VoiceTileData } from "@colibri-social/ui";
import type { VoiceVideo } from "../../data/voice/types";

export type CallView = {
	showNonVideoParticipants: boolean;
	showOwnCamera: boolean;
};

export const callTiles = (input: {
	participants: readonly VoiceParticipant[];
	videos: readonly VoiceVideo[];
	viewer: string;
	view: CallView;
}): VoiceTileData[] => {
	const cameras = new Map<string, MediaStream>();
	const screens: VoiceTileData[] = [];
	const byId = new Map(input.participants.map((person) => [person.id, person]));
	for (const video of input.videos) {
		if (video.source === "cam") {
			cameras.set(video.did, video.stream);
			continue;
		}
		const owner = byId.get(video.did);
		if (!owner) continue;
		screens.push({
			...owner,
			kind: "screen",
			key: `s:${video.did}`,
			speaking: false,
			stream: video.stream,
		});
	}
	const people = input.participants.map((person): VoiceTileData => {
		const self = person.id === input.viewer;
		const stream =
			self && !input.view.showOwnCamera ? undefined : cameras.get(person.id);
		return stream ? { ...person, stream, mirror: self || undefined } : person;
	});
	const anyVideo = screens.length > 0 || people.some((tile) => tile.stream);
	const shown =
		input.view.showNonVideoParticipants || !anyVideo
			? people
			: people.filter((tile) => tile.stream);
	return [...screens, ...shown];
};

export const floatingSubject = (
	tiles: readonly VoiceTileData[],
	input: {
		focusedKey: string | null | undefined;
		lastSpeaker: string | undefined;
		viewer: string;
		keyOf: (tile: VoiceTileData) => string;
	},
): VoiceTileData | undefined =>
	(input.focusedKey
		? tiles.find((tile) => input.keyOf(tile) === input.focusedKey)
		: undefined) ??
	tiles.find((tile) => tile.kind === "screen") ??
	tiles.find((tile) => tile.speaking) ??
	tiles.find((tile) => tile.id === input.lastSpeaker) ??
	tiles.find((tile) => tile.id === input.viewer) ??
	tiles[0];

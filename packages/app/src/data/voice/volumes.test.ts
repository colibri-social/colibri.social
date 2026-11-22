import { describe, expect, it } from "vitest";
import {
	clampVolume,
	isParticipantVolumes,
	playbackGain,
	playbackVolumeOf,
	streamMutedOf,
	volumeOf,
	withStreamMuted,
	withVolume,
} from "./volumes";

const PEER = "did:plc:peer";

describe("participant volumes", () => {
	it("defaults to full volume", () => {
		expect(volumeOf({}, PEER, "voice")).toBe(100);
		expect(volumeOf({ [PEER]: { voice: 40 } }, PEER, "stream")).toBe(100);
	});

	it("stores only the volumes that differ from the default", () => {
		const louder = withVolume({}, PEER, "voice", 150);
		expect(louder).toEqual({ [PEER]: { voice: 150 } });
		expect(withVolume(louder, PEER, "voice", 100)).toEqual({});
		expect(withVolume(louder, PEER, "stream", 20)).toEqual({
			[PEER]: { voice: 150, stream: 20 },
		});
	});

	it("mutes a stream without touching its slider volume", () => {
		const quieter = withVolume({}, PEER, "stream", 60);
		const muted = withStreamMuted(quieter, PEER, true);
		expect(muted).toEqual({ [PEER]: { stream: 60, streamMuted: true } });
		expect(streamMutedOf(muted, PEER)).toBe(true);
		expect(volumeOf(muted, PEER, "stream")).toBe(60);
		expect(playbackVolumeOf(muted, PEER, "stream")).toBe(0);
		expect(playbackVolumeOf(muted, PEER, "voice")).toBe(100);
		const unmuted = withStreamMuted(muted, PEER, false);
		expect(unmuted).toEqual({ [PEER]: { stream: 60 } });
		expect(playbackVolumeOf(unmuted, PEER, "stream")).toBe(60);
		expect(
			withStreamMuted(withStreamMuted({}, PEER, true), PEER, false),
		).toEqual({});
	});

	it("clamps to the slider range", () => {
		expect(clampVolume(-4)).toBe(0);
		expect(clampVolume(250)).toBe(200);
		expect(clampVolume(33.6)).toBe(34);
	});

	it("combines the output and participant volume for playback", () => {
		expect(playbackGain(100, 100)).toBe(1);
		expect(playbackGain(50, 50)).toBe(0.25);
		expect(playbackGain(200, 200)).toBe(4);
		expect(playbackGain(100, 150)).toBe(1.5);
		expect(playbackGain(0, 150)).toBe(0);
	});

	it("rejects stored values it can't use", () => {
		expect(isParticipantVolumes({ [PEER]: { voice: 120 } })).toBe(true);
		expect(isParticipantVolumes({ [PEER]: { voice: 500 } })).toBe(false);
		expect(isParticipantVolumes({ [PEER]: { streamMuted: true } })).toBe(true);
		expect(isParticipantVolumes({ [PEER]: { streamMuted: "yes" } })).toBe(
			false,
		);
		expect(isParticipantVolumes({ [PEER]: "loud" })).toBe(false);
		expect(isParticipantVolumes([])).toBe(false);
		expect(isParticipantVolumes(null)).toBe(false);
	});
});

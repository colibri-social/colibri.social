import { describe, expect, it } from "vitest";
import {
	clampVolume,
	isParticipantVolumes,
	playbackVolume,
	volumeOf,
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

	it("clamps to the slider range", () => {
		expect(clampVolume(-4)).toBe(0);
		expect(clampVolume(250)).toBe(200);
		expect(clampVolume(33.6)).toBe(34);
	});

	it("combines the output and participant volume for playback", () => {
		expect(playbackVolume(100, 100)).toBe(1);
		expect(playbackVolume(50, 50)).toBe(0.25);
		expect(playbackVolume(200, 200)).toBe(1);
		expect(playbackVolume(0, 150)).toBe(0);
	});

	it("rejects stored values it can't use", () => {
		expect(isParticipantVolumes({ [PEER]: { voice: 120 } })).toBe(true);
		expect(isParticipantVolumes({ [PEER]: { voice: 500 } })).toBe(false);
		expect(isParticipantVolumes({ [PEER]: "loud" })).toBe(false);
		expect(isParticipantVolumes([])).toBe(false);
		expect(isParticipantVolumes(null)).toBe(false);
	});
});

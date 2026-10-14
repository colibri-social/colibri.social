import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { Did, Presence, VoiceState } from "./types";
import { createVoice } from "./voice";
import type { VoiceSound } from "./voice-sounds";

const VIEWER = "did:plc:viewer" as Did;
const SPACE = "did:plc:space";
const LOUNGE = `at://${SPACE}/space/social.colibri.beta.channel.voice/lounge`;
const STANDUP = `at://${SPACE}/space/social.colibri.beta.channel.voice/standup`;

const setup = () => {
	const sent: (VoiceState | undefined)[] = [];
	const presence = new Map<string, Presence>();
	const [version, setVersion] = createSignal(0);
	const bump = () => setVersion((value) => value + 1);
	const setVoice = vi.fn(async (state: VoiceState | undefined) => {
		sent.push(state);
		const next: Presence = { onlineState: "online" };
		if (state) next.voice = state;
		presence.set(VIEWER, next);
		bump();
		return next;
	});
	const played: VoiceSound[] = [];
	const { controller, connect } = createVoice((sound) => played.push(sound));
	connect({
		communities: { value: () => [], loading: () => false },
		space: () => {
			throw new Error("unused");
		},
		viewer: { did: VIEWER, handle: "viewer.test", displayName: "Viewer" },
		presenceOf: (did: Did) => {
			version();
			return presence.get(did);
		},
		inVoice: (channel: string) =>
			version() >= 0 &&
			[...presence.entries()]
				.filter(([, value]) => value.voice?.channel === channel)
				.map(([did]) => did as Did),
		isSpeaking: () => false,
		setVoice,
	} as unknown as Parameters<typeof connect>[0]);
	return { voice: controller, sent, setVoice, played };
};

describe("voice", () => {
	it("joins expanded and publishes the viewer's voice state", () => {
		const { voice, sent } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		expect(voice.current()).toEqual({ space: SPACE, channel: LOUNGE });
		expect(voice.expanded()).toBe(true);
		expect(sent.at(-1)).toEqual({
			channel: LOUNGE,
			muted: undefined,
			deafened: undefined,
		});
	});

	it("joins muted when asked", () => {
		const { voice, sent } = setup();
		voice.join({ space: SPACE, channel: LOUNGE }, { muted: true });
		expect(voice.muted()).toBe(true);
		expect(sent.at(-1)?.muted).toBe(true);
	});

	it("treats deafen as mute and restores the previous mic on undeafen", () => {
		const { voice, sent } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.toggleDeafen();
		expect(voice.deafened()).toBe(true);
		expect(voice.muted()).toBe(true);
		expect(sent.at(-1)).toMatchObject({ muted: true, deafened: true });
		voice.toggleDeafen();
		expect(voice.deafened()).toBe(false);
		expect(voice.muted()).toBe(false);
	});

	it("unmuting while deafened clears both", () => {
		const { voice } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.toggleDeafen();
		voice.toggleMute();
		expect(voice.deafened()).toBe(false);
		expect(voice.muted()).toBe(false);
	});

	it("switches the call when joining another channel", () => {
		const { voice, sent } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.toggleCamera();
		voice.collapse();
		voice.join({ space: SPACE, channel: STANDUP });
		expect(voice.current()?.channel).toBe(STANDUP);
		expect(voice.camera()).toBe(false);
		expect(voice.expanded()).toBe(true);
		expect(sent.at(-1)?.channel).toBe(STANDUP);
	});

	it("re-joining the current channel only expands", () => {
		const { voice, setVoice } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.collapse();
		voice.join({ space: SPACE, channel: LOUNGE });
		expect(voice.expanded()).toBe(true);
		expect(setVoice).toHaveBeenCalledTimes(1);
	});

	it("leaves, clears local state and the published voice state", () => {
		const { voice, sent } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.toggleCamera();
		voice.leave();
		expect(voice.current()).toBeUndefined();
		expect(voice.expanded()).toBe(false);
		expect(voice.camera()).toBe(false);
		expect(sent.at(-1)).toBeUndefined();
	});

	it("only expands and toggles the camera during a call", () => {
		const { voice } = setup();
		voice.expand();
		voice.toggleCamera();
		expect(voice.expanded()).toBe(false);
		expect(voice.camera()).toBe(false);
	});

	it("lists the viewer once they are in the channel", async () => {
		const { voice } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		await Promise.resolve();
		expect(voice.participants(LOUNGE).map((person) => person.id)).toEqual([
			VIEWER,
		]);
		expect(voice.participants(STANDUP)).toEqual([]);
	});

	it("plays the call sounds for the viewer's own actions", () => {
		const { voice, played } = setup();
		voice.toggleMute();
		expect(played).toEqual(["mute"]);
		played.length = 0;
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.toggleMute();
		voice.toggleMute();
		voice.toggleDeafen();
		voice.toggleDeafen();
		voice.toggleCamera();
		voice.toggleCamera();
		voice.leave();
		expect(played).toEqual([
			"join",
			"unmute",
			"mute",
			"deafen",
			"undeafen",
			"camOn",
			"camOff",
			"leave",
		]);
	});

	it("plays mute and deafen sounds without a call and publishes nothing", () => {
		const { voice, played, sent } = setup();
		voice.toggleMute();
		voice.toggleMute();
		voice.toggleDeafen();
		voice.toggleDeafen();
		voice.cue("mute");
		expect(played).toEqual(["mute", "unmute", "deafen", "undeafen", "mute"]);
		expect(sent).toEqual([]);
		voice.toggleCamera();
		expect(played).toHaveLength(5);
	});
});

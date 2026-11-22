import { createSignal } from "solid-js";
import { expect, it } from "vitest";
import type { Did, Presence, VoiceState } from "./types";
import { createVoice } from "./voice";
import type { VoiceSound } from "./voice-sounds";

const VIEWER = "did:plc:viewer" as Did;
const SPACE = "did:plc:space";
const LOUNGE = `at://${SPACE}/space/social.colibri.beta.channel.voice/lounge`;
const STANDUP = `at://${SPACE}/space/social.colibri.beta.channel.voice/standup`;

const setup = () => {
	const presence = new Map<string, Presence>();
	const [version, setVersion] = createSignal(0);
	const bump = () => setVersion((value) => value + 1);
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
		inVoice: (channel: string) => {
			version();
			return [...presence.entries()]
				.filter(([, value]) => value.voice?.channel === channel)
				.map(([did]) => did as Did);
		},
		isSpeaking: () => false,
		setVoice: async (state: VoiceState | undefined) => {
			presence.set(VIEWER, {
				onlineState: "online",
				...(state ? { voice: state } : {}),
			});
			bump();
			return presence.get(VIEWER);
		},
	} as unknown as Parameters<typeof connect>[0]);
	const setOther = (did: string, channel: string | undefined) => {
		presence.set(did, {
			onlineState: "online",
			...(channel ? { voice: { channel } as VoiceState } : {}),
		});
		bump();
	};
	return { voice: controller, played, setOther };
};

it("plays join and leave when others enter or leave the current call", async () => {
	const { voice, played, setOther } = setup();
	setOther("did:plc:early", LOUNGE);
	voice.join({ space: SPACE, channel: LOUNGE });
	await Promise.resolve();
	expect(played).toEqual(["join"]);
	played.length = 0;
	setOther("did:plc:other", LOUNGE);
	setOther("did:plc:elsewhere", STANDUP);
	setOther("did:plc:early", undefined);
	expect(played).toEqual(["join", "leave"]);
	voice.leave();
	played.length = 0;
	setOther("did:plc:late", LOUNGE);
	expect(played).toEqual([]);
});

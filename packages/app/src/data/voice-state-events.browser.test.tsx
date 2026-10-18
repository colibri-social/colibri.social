import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { createDataStore } from "./store";
import type { Did, SpaceRef } from "./types";

const LOUNGE =
	"at://did:plc:colibrihqspace2a4b6c8d/space/social.colibri.beta.channel.voice/lounge" as SpaceRef;
const STANDUP =
	"at://did:plc:colibrihqspace2a4b6c8d/space/social.colibri.beta.channel.voice/standup" as SpaceRef;
const CALLER = "did:plc:voicecallervoicecaller00" as Did;

const setup = () => {
	setLatency(0);
	const source = createMockSource({ live: false });
	const store = createRoot(() => createDataStore(source));
	return { source, store };
};

describe("voice state live events", () => {
	it("puts a caller into the roster on join and takes them out on leave", () => {
		const { source, store } = setup();
		source.emit({
			$type: "voiceStateEvent",
			did: CALLER,
			channel: LOUNGE,
			voice: { channel: LOUNGE },
		});
		expect(store.inVoice(LOUNGE)).toContain(CALLER);
		expect(store.presenceOf(CALLER)?.onlineState).toBe("online");

		source.emit({ $type: "voiceActivityEvent", did: CALLER, speaking: true });
		expect(store.isSpeaking(CALLER)).toBe(true);

		source.emit({ $type: "voiceStateEvent", did: CALLER, channel: LOUNGE });
		source.emit({ $type: "voiceActivityEvent", did: CALLER, speaking: false });
		expect(store.inVoice(LOUNGE)).not.toContain(CALLER);
		expect(store.presenceOf(CALLER)?.voice).toBeUndefined();
		expect(store.isSpeaking(CALLER)).toBe(false);
	});

	it("updates mute state and keeps the rest of the presence", () => {
		const { source, store } = setup();
		source.emit({
			$type: "presenceEvent",
			did: CALLER,
			presence: { onlineState: "dnd", status: { text: "focus" } },
		});
		source.emit({
			$type: "voiceStateEvent",
			did: CALLER,
			channel: LOUNGE,
			voice: { channel: LOUNGE },
		});
		source.emit({
			$type: "voiceStateEvent",
			did: CALLER,
			channel: LOUNGE,
			voice: { channel: LOUNGE, muted: true },
		});
		expect(store.presenceOf(CALLER)).toEqual({
			onlineState: "dnd",
			status: { text: "focus" },
			voice: { channel: LOUNGE, muted: true },
		});
	});

	it("ignores a late leave for a channel the caller already moved away from", () => {
		const { source, store } = setup();
		source.emit({
			$type: "voiceStateEvent",
			did: CALLER,
			channel: STANDUP,
			voice: { channel: STANDUP },
		});
		source.emit({ $type: "voiceStateEvent", did: CALLER, channel: LOUNGE });
		expect(store.inVoice(STANDUP)).toContain(CALLER);
	});
});

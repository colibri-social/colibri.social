import { describe, expect, it } from "vitest";
import type { Did, Presence, VoiceState } from "../data/types";
import { createVoice } from "../data/voice";
import {
	installNativeCall,
	type NativeCallAction,
	type NativeCallInfo,
	type NativeCallPort,
} from "./call";

const VIEWER = "did:plc:viewer" as Did;
const SPACE = "did:plc:space";
const LOUNGE = `at://${SPACE}/space/social.colibri.beta.channel.voice/lounge`;

const setup = () => {
	const presence = new Map<string, Presence>();
	const { controller, connect } = createVoice();
	connect({
		communities: { value: () => [], loading: () => false },
		space: () => {
			throw new Error("unused");
		},
		viewer: { did: VIEWER, handle: "viewer.test", displayName: "Viewer" },
		presenceOf: (did: Did) => presence.get(did),
		inVoice: () => [],
		isSpeaking: () => false,
		setVoice: async (state: VoiceState | undefined) => {
			const next: Presence = { onlineState: "online" };
			if (state) next.voice = state;
			presence.set(VIEWER, next);
			return next;
		},
	} as unknown as Parameters<typeof connect>[0]);

	const calls: { kind: string; info?: NativeCallInfo }[] = [];
	let fire: ((action: NativeCallAction) => void) | undefined;
	const port: NativeCallPort = {
		start: (info) => calls.push({ kind: "start", info }),
		update: (info) => calls.push({ kind: "update", info }),
		stop: () => calls.push({ kind: "stop" }),
		onAction: (listener) => {
			fire = listener;
			return () => {
				fire = undefined;
			};
		},
	};
	const community = { did: SPACE, name: "Colibri HQ" };
	const data = {
		spaceByKey: (key: string) => (key === SPACE ? community : undefined),
		space: () => ({
			channelBySlug: (slug: string) =>
				slug === "lounge" ? { name: "Lounge" } : undefined,
		}),
	} as unknown as Parameters<typeof installNativeCall>[0];
	const dispose = installNativeCall(data, port, controller);
	return {
		voice: controller,
		calls,
		dispose,
		fire: (action: NativeCallAction) => fire?.(action),
	};
};

describe("native call", () => {
	it("does nothing without a native port", () => {
		const dispose = installNativeCall(
			{} as Parameters<typeof installNativeCall>[0],
			undefined,
		);
		expect(() => dispose()).not.toThrow();
	});

	it("starts with the channel and Space names, updates and stops", () => {
		const { voice, calls } = setup();
		expect(calls).toEqual([]);
		voice.join({ space: SPACE, channel: LOUNGE });
		expect(calls[0]?.kind).toBe("start");
		expect(calls[0]?.info).toMatchObject({
			title: "Lounge",
			subtitle: "Colibri HQ",
			muted: false,
			deafened: false,
		});
		voice.toggleDeafen();
		expect(calls.at(-1)).toMatchObject({
			kind: "update",
			info: { muted: true, deafened: true },
		});
		voice.leave();
		expect(calls.at(-1)?.kind).toBe("stop");
	});

	it("routes notification actions to the call", () => {
		const { voice, fire } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.collapse();
		fire("mute");
		expect(voice.muted()).toBe(true);
		fire("open");
		expect(voice.expanded()).toBe(true);
		fire("leave");
		expect(voice.current()).toBeUndefined();
	});

	it("stops the native call on dispose", () => {
		const { voice, calls, dispose } = setup();
		voice.join({ space: SPACE, channel: LOUNGE });
		dispose();
		expect(calls.at(-1)?.kind).toBe("stop");
	});
});

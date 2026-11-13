import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { voiceChatAvailable } from "../screens/voice/voice-chat";
import type { VoiceNoticeKey } from "./error-copy";
import { channelSlug, skeyOf } from "./ids";
import { createMockSource, setLatency } from "./mock/source";
import { createMockVoiceConnection } from "./mock/voice";
import { createSimulatedConnection } from "./mock/voice-connection";
import { createDataStore } from "./store";
import type { ChannelView, Did } from "./types";
import {
	createVoice,
	setVoiceConnectionMonitor,
	setVoiceNotifier,
	voice,
} from "./voice";
import type { VoicePermissions } from "./voice/types";

const OWLS = "did:plc:nightowlsartclub3e5f7g9h" as Did;

afterEach(() => {
	voice.leave();
	setVoiceConnectionMonitor(createSimulatedConnection());
	setVoiceNotifier(() => {});
});

const setup = async () => {
	setLatency(0);
	const source = createMockSource({ live: false });
	const store = createRoot(() => createDataStore(source));
	setVoiceConnectionMonitor(
		createMockVoiceConnection(source.world, {
			connectMs: 0,
			moveMs: 20,
			grantMs: 40,
		}),
	);
	const notices: VoiceNoticeKey[] = [];
	setVoiceNotifier((key) => notices.push(key));
	await vi.waitFor(() => expect(store.communities.value()).toBeDefined());
	const community = store.communities
		.value()
		?.find((entry) => entry.did === OWLS);
	if (!community) throw new Error("the owls Space is missing");
	const space = store.space(community);
	await vi.waitFor(() => {
		expect(space.channels.value()).toBeDefined();
		expect(space.categories.value()).toBeDefined();
	});
	const bySkey = (skey: string) =>
		space.channels
			.value()
			?.find((entry) => skeyOf(entry.space) === skey) as ChannelView;
	const voiceRow = () =>
		(
			space.categories.value()?.find((entry) => entry.rkey === "voice")
				?.channels ?? []
		).map((entry) => skeyOf(entry.space));
	return { store, community, space, bySkey, voiceRow, notices };
};

describe("voice permissions against the mock", () => {
	it("hides chat and denies speaking where the role doesn't allow it", async () => {
		const { store, community, bySkey } = await setup();
		const waiting = bySkey("waiting-room");
		const drawAlong = bySkey("draw-along");

		expect(voiceChatAvailable(store, community, drawAlong)).toBe(true);
		expect(voiceChatAvailable(store, community, waiting)).toBe(false);

		voice.join({ space: "owls", channel: waiting.space });
		expect(voice.micDenied()).toBe(true);
		expect(voice.muted()).toBe(true);
		expect(voice.cameraDenied()).toBe(false);
	});

	it("shows a moved-into hidden channel in place until the call ends", async () => {
		const { store, community, space, bySkey, voiceRow, notices } =
			await setup();
		expect(voiceRow()).not.toContain("critique-booth");

		voice.join({ space: "owls", channel: bySkey("waiting-room").space });
		await vi.waitFor(() =>
			expect(skeyOf(voice.current()?.channel ?? "")).toBe("critique-booth"),
		);

		expect(voiceRow()).toEqual([
			"draw-along",
			"quiet-studio",
			"waiting-room",
			"critique-booth",
		]);
		const booth = bySkey("critique-booth");
		expect(space.channelBySlug(channelSlug(booth))?.name).toBe(
			"Critique booth",
		);
		expect(space.isGuestChannel(booth.space)).toBe(true);
		expect(voiceChatAvailable(store, community, booth)).toBe(false);
		expect(voice.listenDenied()).toBe(true);
		expect(notices).toContain("movedPrivate");

		await vi.waitFor(() => expect(voice.listenDenied()).toBe(false));
		expect(voice.cameraDenied()).toBe(false);
		expect(voice.screenshareDenied()).toBe(true);
		expect(voiceChatAvailable(store, community, booth)).toBe(false);

		voice.leave();
		expect(voiceRow()).not.toContain("critique-booth");
		expect(bySkey("critique-booth")).toBeUndefined();
	});
});

describe("permission changes mid-call", () => {
	it("tells the viewer and publishes the forced mute", async () => {
		const [permissions, setPermissions] = createSignal<VoicePermissions>(
			new Set(["voice.speak", "voice.listen", "voice.camera", "voice.chat"]),
		);
		const notices: VoiceNoticeKey[] = [];
		const sent: unknown[] = [];
		const { controller, connect, dispose } = createRoot((dispose) => ({
			...createVoice(
				() => {},
				() => ({ ...createSimulatedConnection(), permissions }),
				(key) => notices.push(key),
			),
			dispose,
		}));
		connect({
			communities: { value: () => [], loading: () => false },
			viewer: { did: "did:plc:viewer", handle: "viewer.test" },
			presenceOf: () => undefined,
			inVoice: () => [],
			isSpeaking: () => false,
			setVoice: async (state: unknown) => {
				sent.push(state);
				return { onlineState: "online" };
			},
		} as unknown as Parameters<typeof connect>[0]);
		const lounge = `at://${OWLS}/space/social.colibri.beta.channel.voice/lounge`;

		controller.join({ space: "owls", channel: lounge });
		controller.toggleCamera();
		expect(controller.muted()).toBe(false);
		expect(controller.camera()).toBe(true);

		setPermissions(new Set(["voice.listen", "voice.chat"]));
		expect(controller.micDenied()).toBe(true);
		expect(controller.camera()).toBe(false);
		expect(notices).toEqual(["speakDenied", "cameraDenied"]);
		expect(sent.at(-1)).toMatchObject({ channel: lounge, muted: true });

		setPermissions(new Set(["voice.speak", "voice.listen", "voice.chat"]));
		expect(controller.muted()).toBe(false);
		expect(controller.camera()).toBe(false);
		expect(notices).toEqual(["speakDenied", "cameraDenied"]);
		controller.leave();
		dispose();
	});
});

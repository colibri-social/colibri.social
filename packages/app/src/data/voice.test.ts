import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { ProfileTheme } from "./source";
import type { Did, Presence, VoiceState } from "./types";
import { createVoice } from "./voice";
import type {
	VoiceConnection,
	VoiceConnectionMonitor,
	VoiceEndReason,
	VoiceModeration,
	VoiceSession,
	VoiceVideo,
} from "./voice/types";
import type { VoiceSound } from "./voice-sounds";

const VIEWER = "did:plc:viewer" as Did;
const SPACE = "did:plc:space";
const LOUNGE = `at://${SPACE}/space/social.colibri.beta.channel.voice/lounge`;
const STANDUP = `at://${SPACE}/space/social.colibri.beta.channel.voice/standup`;

const setup = (theme?: ProfileTheme) => {
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
		viewer: {
			did: VIEWER,
			handle: "viewer.test",
			displayName: "Viewer",
			theme,
		},
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
	const setPresence = (did: Did, voice: VoiceState) => {
		presence.set(did, { onlineState: "online", voice });
		bump();
	};
	return { voice: controller, sent, setVoice, played, setPresence };
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

	it("fills a participant's tile with their banner colors", async () => {
		const cases: [ProfileTheme | undefined, string | undefined][] = [
			[{ bannerColor: "#336699" }, "#336699"],
			[
				{ gradient: { primary: "#112233", secondary: "#445566" } },
				"linear-gradient(135deg, #112233, #445566)",
			],
			[undefined, undefined],
		];
		for (const [theme, fill] of cases) {
			const { voice } = setup(theme);
			voice.join({ space: SPACE, channel: LOUNGE });
			await Promise.resolve();
			expect(voice.participants(LOUNGE)[0]?.bannerFill).toBe(fill);
			voice.leave();
		}
	});

	it("marks participants sharing a camera or screen as streaming, joined or not", () => {
		const { voice, setPresence } = setup();
		const alice = "did:plc:alice" as Did;
		const bob = "did:plc:bob" as Did;
		const carol = "did:plc:carol" as Did;
		setPresence(alice, {
			channel: STANDUP as VoiceState["channel"],
			camera: true,
		});
		setPresence(bob, {
			channel: STANDUP as VoiceState["channel"],
			screen: true,
		});
		setPresence(carol, { channel: STANDUP as VoiceState["channel"] });
		expect(
			voice
				.participants(STANDUP)
				.map((person) => [person.id, person.streaming]),
		).toEqual([
			[alice, true],
			[bob, true],
			[carol, undefined],
		]);
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

const fakeMonitor = () => {
	const [connection, setConnection] = createSignal<VoiceConnection>({
		state: "disconnected",
		quality: "unknown",
		latency: null,
	});
	const [speakers, setSpeakers] = createSignal<ReadonlySet<string>>(new Set());
	const [videos, setVideos] = createSignal<readonly VoiceVideo[]>([]);
	const [moderation, setModeration] = createSignal<
		Record<string, VoiceModeration>
	>({});
	let endedListener: ((reason: VoiceEndReason) => void) | undefined;
	let movedListener: ((channel: string) => void) | undefined;
	let cameraResult = true;
	const [screenSharing, setScreenSharing] = createSignal(false);
	let screenShareListener: ((sharing: boolean) => void) | undefined;
	const monitor = {
		connection,
		start: vi.fn((session?: VoiceSession) => {
			if (session) setConnection({ ...connection(), state: "connecting" });
		}),
		stop: vi.fn(),
		setMuted: vi.fn(),
		setDeafened: vi.fn(),
		setCamera: vi.fn(async (on: boolean) => on && cameraResult),
		shareScreen: vi.fn(async () => {
			setScreenSharing(true);
			screenShareListener?.(true);
			return true;
		}),
		stopScreen: vi.fn(() => {
			setScreenSharing(false);
			screenShareListener?.(false);
		}),
		applyScreenQuality: vi.fn(),
		screenSharing,
		onScreenShare: (listener: (sharing: boolean) => void) => {
			screenShareListener = listener;
			return () => {
				screenShareListener = undefined;
			};
		},
		speakers,
		videos,
		moderation,
		onEnded: (listener: (reason: VoiceEndReason) => void) => {
			endedListener = listener;
			return () => {
				endedListener = undefined;
			};
		},
		onMoved: (listener: (channel: string) => void) => {
			movedListener = listener;
			return () => {
				movedListener = undefined;
			};
		},
	} satisfies VoiceConnectionMonitor;
	return {
		monitor,
		setSpeakers,
		setVideos,
		setModeration,
		end: (reason: VoiceEndReason) => endedListener?.(reason),
		move: (channel: string) => movedListener?.(channel),
		peerScreen: (sharing: boolean) => screenShareListener?.(sharing),
		failCamera: () => {
			cameraResult = false;
		},
	};
};

const setupWithMonitor = () => {
	const fake = fakeMonitor();
	const notices: string[] = [];
	const sent: (VoiceState | undefined)[] = [];
	const presence = new Map<string, Presence>();
	const [version, setVersion] = createSignal(0);
	const played: VoiceSound[] = [];
	const { controller, connect } = createVoice(
		(sound) => played.push(sound),
		() => fake.monitor,
		(key) => notices.push(key),
	);
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
		isSpeaking: () => true,
		setVoice: async (state: VoiceState | undefined) => {
			sent.push(state);
			const next: Presence = { onlineState: "online" };
			if (state) next.voice = state;
			presence.set(VIEWER, next);
			setVersion((value) => value + 1);
			return next;
		},
	} as unknown as Parameters<typeof connect>[0]);
	return { voice: controller, fake, notices, sent, played };
};

describe("voice with a media engine", () => {
	it("starts the engine with the viewer's mute state", () => {
		const { voice, fake } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE }, { muted: true });
		expect(fake.monitor.start).toHaveBeenCalledWith({
			channel: LOUNGE,
			muted: true,
			deafened: false,
		});
	});

	it("passes mute and deafen changes to the engine", () => {
		const { voice, fake } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE });
		voice.toggleDeafen();
		expect(fake.monitor.setDeafened).toHaveBeenLastCalledWith(true);
		expect(fake.monitor.setMuted).toHaveBeenLastCalledWith(true);
		voice.toggleMute();
		expect(fake.monitor.setDeafened).toHaveBeenLastCalledWith(false);
		expect(fake.monitor.setMuted).toHaveBeenLastCalledWith(false);
	});

	it("takes speaking state from the engine, only for the joined call", async () => {
		const { voice, fake } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE });
		await Promise.resolve();
		expect(voice.participants(LOUNGE)[0]?.speaking).toBe(false);
		fake.setSpeakers(new Set([VIEWER]));
		expect(voice.participants(LOUNGE)[0]?.speaking).toBe(true);
	});

	it("takes streaming from the engine's videos, only for the joined call", async () => {
		const { voice, fake } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE });
		await Promise.resolve();
		expect(voice.participants(LOUNGE)[0]?.streaming).toBeUndefined();
		fake.setVideos([{ did: VIEWER, source: "cam", stream: {} as MediaStream }]);
		expect(voice.participants(LOUNGE)[0]?.streaming).toBe(true);
		voice.leave();
		expect(voice.participants(LOUNGE)).toEqual([]);
	});

	it("keeps the viewer muted while a moderator has them muted", () => {
		const { voice, fake, notices, played } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE }, { muted: true });
		fake.setModeration({
			[VIEWER]: { serverMuted: true, serverDeafened: false },
		});
		played.length = 0;
		voice.toggleMute();
		expect(voice.muted()).toBe(true);
		expect(notices).toEqual(["serverMuted"]);
		expect(played).toEqual([]);
		expect(voice.moderationOf(VIEWER).serverMuted).toBe(true);
	});

	it("leaves and tells the viewer when the engine ends the call", () => {
		const { voice, fake, notices, sent, played } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE });
		played.length = 0;
		fake.end("moderator");
		expect(voice.current()).toBeUndefined();
		expect(notices).toEqual(["moderator"]);
		expect(played).toEqual(["leave"]);
		expect(sent.at(-1)).toBeUndefined();
	});

	it("rejoins the destination when a moderator moves the viewer", () => {
		const { voice, fake, notices, sent, played } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE }, { muted: true });
		played.length = 0;
		fake.move(STANDUP);
		expect(voice.current()).toEqual({ space: SPACE, channel: STANDUP });
		expect(fake.monitor.start).toHaveBeenLastCalledWith({
			channel: STANDUP,
			muted: true,
			deafened: false,
		});
		expect(notices).toEqual(["moved"]);
		expect(played).toEqual(["join"]);
		expect(sent.at(-1)).toEqual({
			channel: STANDUP,
			muted: true,
			deafened: undefined,
		});
	});

	it("ignores a move while the viewer is not in a call", () => {
		const { voice, fake, notices } = setupWithMonitor();
		fake.move(STANDUP);
		expect(voice.current()).toBeUndefined();
		expect(notices).toEqual([]);
	});

	it("turns the camera back off when the engine can't start it", async () => {
		const { voice, fake } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE });
		fake.failCamera();
		voice.toggleCamera();
		expect(voice.camera()).toBe(true);
		await vi.waitFor(() => expect(voice.camera()).toBe(false));
		expect(fake.monitor.setCamera).toHaveBeenCalledWith(true);
	});

	it("shares the screen during a call and plays the share sounds", async () => {
		const { voice, fake, played } = setupWithMonitor();
		const capture = {
			video: { stop: vi.fn() } as unknown as MediaStreamTrack,
			audio: null,
			release: vi.fn(),
		};
		const quality = { resolution: "1080", framerate: 30 } as const;
		expect(await voice.shareScreen(capture, quality)).toBe(false);
		expect(capture.release).toHaveBeenCalledOnce();
		voice.join({ space: SPACE, channel: LOUNGE });
		played.length = 0;
		expect(await voice.shareScreen(capture, quality)).toBe(true);
		expect(fake.monitor.shareScreen).toHaveBeenCalledWith(capture, quality);
		expect(voice.screenSharing()).toBe(true);
		voice.applyScreenQuality({ resolution: "720", framerate: 15 });
		expect(fake.monitor.applyScreenQuality).toHaveBeenCalledWith({
			resolution: "720",
			framerate: 15,
		});
		voice.stopScreenShare();
		expect(voice.screenSharing()).toBe(false);
		expect(played).toEqual(["screenShared", "screenUnshared"]);
	});

	it("plays the share sounds when someone else shares", () => {
		const { voice, fake, played } = setupWithMonitor();
		fake.peerScreen(true);
		expect(played).toEqual([]);
		voice.join({ space: SPACE, channel: LOUNGE });
		played.length = 0;
		fake.peerScreen(true);
		fake.peerScreen(false);
		expect(played).toEqual(["screenShared", "screenUnshared"]);
	});

	it("stays quiet about the share when leaving the call", async () => {
		const { voice, played } = setupWithMonitor();
		voice.join({ space: SPACE, channel: LOUNGE });
		await voice.shareScreen(
			{
				video: { stop: vi.fn() } as unknown as MediaStreamTrack,
				audio: null,
				release: vi.fn(),
			},
			{ resolution: "1080", framerate: 30 },
		);
		played.length = 0;
		voice.leave();
		expect(voice.screenSharing()).toBe(false);
		expect(played).toEqual(["leave"]);
	});
});

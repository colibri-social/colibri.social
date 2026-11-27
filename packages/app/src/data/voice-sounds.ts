import { classifyThrown, createLogger } from "@colibri-social/lib";
import camOffUrl from "../../../assets/files/sounds/cam-off.wav";
import camOnUrl from "../../../assets/files/sounds/cam-on.wav";
import deafenUrl from "../../../assets/files/sounds/deafen.wav";
import joinUrl from "../../../assets/files/sounds/join.wav";
import leaveUrl from "../../../assets/files/sounds/leave.wav";
import muteUrl from "../../../assets/files/sounds/mute.wav";
import screenSharedUrl from "../../../assets/files/sounds/screen-shared.wav";
import screenUnsharedUrl from "../../../assets/files/sounds/screen-unshared.wav";
import undeafenUrl from "../../../assets/files/sounds/undeafen.wav";
import unmuteUrl from "../../../assets/files/sounds/unmute.wav";
import {
	DEFAULT_SOUND_VOLUMES,
	SOUND_GROUPS,
	type SoundGroup,
	type SoundVolumes,
} from "./preferences/types";
import {
	applyAudioSink,
	DEFAULT_CONTEXT_SINK_ID,
	type SinkableOutput,
} from "./voice/audio-sink";

const log = createLogger("voice/sounds");

export const VOICE_SOUNDS = {
	join: joinUrl,
	leave: leaveUrl,
	mute: muteUrl,
	unmute: unmuteUrl,
	deafen: deafenUrl,
	undeafen: undeafenUrl,
	camOn: camOnUrl,
	camOff: camOffUrl,
	screenShared: screenSharedUrl,
	screenUnshared: screenUnsharedUrl,
} as const;

export type VoiceSound = keyof typeof VOICE_SOUNDS;

export type VoiceSoundPlayer = (sound: VoiceSound) => void;

export const SOUND_GROUP_OF = {
	ping: "ping",
	join: "presence",
	leave: "presence",
	mute: "mic",
	unmute: "mic",
	deafen: "mic",
	undeafen: "mic",
	camOn: "video",
	camOff: "video",
	screenShared: "video",
	screenUnshared: "video",
} as const satisfies Record<VoiceSound | "ping", SoundGroup>;

export type GroupedSound = keyof typeof SOUND_GROUP_OF;

export type SoundPlayer<Sound extends GroupedSound> = (
	sound: Sound,
	volume?: number,
) => void;

const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

type NativeSoundBridge = {
	hasSound: (name: string) => boolean;
	storeSound: (name: string, base64: string) => void;
	playSound: (name: string) => void;
	playSoundAt?: (name: string, volume: number) => void;
};

const gainOf = (percent: number, fallback: number) => {
	return Number.isFinite(percent)
		? Math.min(1, Math.max(0, percent / 100))
		: fallback / 100;
};

const groupGains = Object.fromEntries(
	SOUND_GROUPS.map((group) => [group, DEFAULT_SOUND_VOLUMES[group] / 100]),
) as Record<SoundGroup, number>;

export const setSoundEffectsVolumes = (volumes: SoundVolumes) => {
	for (const group of SOUND_GROUPS) {
		groupGains[group] = gainOf(volumes[group], DEFAULT_SOUND_VOLUMES[group]);
	}
};

export const soundEffectsGain = (sound: GroupedSound) => {
	return groupGains[SOUND_GROUP_OF[sound]];
};

const gainFor = (sound: GroupedSound, volume: number | undefined) => {
	return volume === undefined
		? soundEffectsGain(sound)
		: gainOf(volume, DEFAULT_SOUND_VOLUMES[SOUND_GROUP_OF[sound]]);
};

let effectsSink: string | undefined;
const sinkListeners = new Set<(force: boolean) => void>();

export const setSoundEffectsSink = (deviceId: string | undefined) => {
	effectsSink = deviceId || undefined;
	for (const listener of sinkListeners) listener(false);
};

export const refreshSoundEffectsSink = () => {
	for (const listener of sinkListeners) listener(true);
};

export const soundEffectsSink = () => effectsSink;

const nativeSoundBridge = (): NativeSoundBridge | undefined => {
	if (typeof window === "undefined") return undefined;
	const bridge = (
		window as unknown as { __colibriCall?: Partial<NativeSoundBridge> }
	).__colibriCall;
	return bridge?.playSound && bridge.hasSound && bridge.storeSound
		? (bridge as NativeSoundBridge)
		: undefined;
};

const toBase64 = (data: ArrayBuffer) => {
	const bytes = new Uint8Array(data);
	let binary = "";
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
};

const fileName = (url: string) =>
	url
		.split("/")
		.pop()
		?.split("?")[0]
		?.replace(/\.[^.]+$/, "") ?? url;

export const createNativeSoundPlayer = <
	Sound extends GroupedSound = VoiceSound,
>(
	bridge: NativeSoundBridge,
	sounds: Record<Sound, string> = VOICE_SOUNDS as Record<Sound, string>,
): SoundPlayer<Sound> => {
	const stored = new Map<Sound, Promise<string | undefined>>();
	const ensure = (sound: Sound) => {
		const cached = stored.get(sound);
		if (cached) return cached;
		const name = fileName(sounds[sound]);
		const pending = bridge.hasSound(name)
			? Promise.resolve(name)
			: fetch(sounds[sound])
					.then((response) => {
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						return response.arrayBuffer();
					})
					.then((data) => {
						bridge.storeSound(name, toBase64(data));
						return name;
					})
					.catch(() => {
						stored.delete(sound);
						return undefined;
					});
		stored.set(sound, pending);
		return pending;
	};
	return (sound, volume) => {
		if (gainFor(sound, volume) <= 0) return;
		void ensure(sound).then((name) => {
			const gain = gainFor(sound, volume);
			if (!name || gain <= 0) return;
			if (bridge.playSoundAt) bridge.playSoundAt(name, gain);
			else bridge.playSound(name);
		});
	};
};

export const createSoundPlayer = <Sound extends GroupedSound>(
	sounds: Record<Sound, string>,
): SoundPlayer<Sound> => {
	const native = nativeSoundBridge();
	if (native) return createNativeSoundPlayer(native, sounds);
	let context: AudioContext | undefined;
	let unlockBound = false;
	let routing: Promise<void> = Promise.resolve();
	const buffers = new Map<Sound, Promise<AudioBuffer | undefined>>();

	const route = (ctx: AudioContext, force: boolean) => {
		routing = routing
			.then(() =>
				applyAudioSink(ctx as AudioContext & SinkableOutput, effectsSink, {
					force,
					defaultId: DEFAULT_CONTEXT_SINK_ID,
				}),
			)
			.then(
				() => undefined,
				(error: unknown) => {
					log.warn("could not route sounds to the selected speaker", {
						code: classifyThrown(error).code,
					});
				},
			);
	};

	const ensureContext = () => {
		if (context) return context;
		if (typeof AudioContext === "undefined") return undefined;
		const created = new AudioContext({ latencyHint: "interactive" });
		context = created;
		route(created, true);
		sinkListeners.add((force) => route(created, force));
		return created;
	};

	const bindUnlock = (ctx: AudioContext) => {
		if (unlockBound || typeof window === "undefined") return;
		unlockBound = true;
		const unlock = () => {
			if (ctx.state !== "running") void ctx.resume().catch(() => {});
		};
		for (const name of UNLOCK_EVENTS) {
			window.addEventListener(name, unlock, { capture: true, passive: true });
		}
	};

	const load = (ctx: AudioContext, sound: Sound) => {
		const cached = buffers.get(sound);
		if (cached) return cached;
		const pending = fetch(sounds[sound])
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.arrayBuffer();
			})
			.then((data) => ctx.decodeAudioData(data))
			.catch(() => {
				buffers.delete(sound);
				return undefined;
			});
		buffers.set(sound, pending);
		return pending;
	};

	return (sound, volume) => {
		if (gainFor(sound, volume) <= 0) return;
		const ctx = ensureContext();
		if (!ctx) return;
		bindUnlock(ctx);
		void (async () => {
			const resumed =
				ctx.state === "running" ||
				(await ctx.resume().then(
					() => (ctx.state as AudioContextState) === "running",
					() => false,
				));
			const buffer = await load(ctx, sound);
			await routing;
			const gain = gainFor(sound, volume);
			if (!buffer || !resumed || gain <= 0) return;
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			const output = ctx.createGain();
			output.gain.value = gain;
			source.connect(output);
			output.connect(ctx.destination);
			source.addEventListener("ended", () => output.disconnect(), {
				once: true,
			});
			source.start();
		})();
	};
};

export const createVoiceSoundPlayer = (): VoiceSoundPlayer =>
	createSoundPlayer(VOICE_SOUNDS);

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

const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

type NativeSoundBridge = {
	hasSound: (name: string) => boolean;
	storeSound: (name: string, base64: string) => void;
	playSound: (name: string) => void;
};

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

export const createNativeSoundPlayer = <Sound extends string = VoiceSound>(
	bridge: NativeSoundBridge,
	sounds: Record<Sound, string> = VOICE_SOUNDS as Record<Sound, string>,
): ((sound: Sound) => void) => {
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
	return (sound) => {
		void ensure(sound).then((name) => {
			if (name) bridge.playSound(name);
		});
	};
};

export const createSoundPlayer = <Sound extends string>(
	sounds: Record<Sound, string>,
): ((sound: Sound) => void) => {
	const native = nativeSoundBridge();
	if (native) return createNativeSoundPlayer(native, sounds);
	let context: AudioContext | undefined;
	let unlockBound = false;
	const buffers = new Map<Sound, Promise<AudioBuffer | undefined>>();

	const ensureContext = () => {
		if (context) return context;
		if (typeof AudioContext === "undefined") return undefined;
		context = new AudioContext({ latencyHint: "interactive" });
		return context;
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

	return (sound) => {
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
			if (!buffer || !resumed) return;
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.connect(ctx.destination);
			source.start();
		})();
	};
};

export const createVoiceSoundPlayer = (): VoiceSoundPlayer =>
	createSoundPlayer(VOICE_SOUNDS);

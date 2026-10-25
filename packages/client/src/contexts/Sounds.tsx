import { classifyThrown } from "@colibri-social/lib";
import {
	createContext,
	onCleanup,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { createLogger } from "../utils/logger";

const log = createLogger("sounds");

const SOUND_URLS = {
	mute: "/sounds/mute.wav",
	unmute: "/sounds/unmute.wav",
	deafen: "/sounds/deafen.wav",
	undeafen: "/sounds/undeafen.wav",
	screenShared: "/sounds/screen-shared.wav",
	screenUnshared: "/sounds/screen-unshared.wav",
	camOn: "/sounds/cam-on.wav",
	camOff: "/sounds/cam-off.wav",
	join: "/sounds/join.wav",
	leave: "/sounds/leave.wav",
	ping: "/sounds/ping.wav",
} as const;

type SoundByteID = keyof typeof SOUND_URLS;

type SoundsContextValue = {
	playSound: (soundByte: SoundByteID) => void;
};

const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

const SoundsContext = createContext<SoundsContextValue>();

export const SoundsContextProvider: ParentComponent = (props) => {
	let context: AudioContext | undefined;
	const buffers = new Map<SoundByteID, Promise<AudioBuffer | undefined>>();

	const getContext = (): AudioContext | undefined => {
		if (context) return context;
		if (typeof AudioContext === "undefined") return undefined;
		context = new AudioContext({ latencyHint: "interactive" });
		return context;
	};

	const loadBuffer = (
		ctx: AudioContext,
		soundByte: SoundByteID,
	): Promise<AudioBuffer | undefined> => {
		const cached = buffers.get(soundByte);
		if (cached) return cached;
		const pending = fetch(SOUND_URLS[soundByte])
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.arrayBuffer();
			})
			.then((data) => ctx.decodeAudioData(data))
			.catch((err: unknown) => {
				buffers.delete(soundByte);
				log.warn("sound failed to load", {
					soundByte,
					code: classifyThrown(err).code,
				});
				return undefined;
			});
		buffers.set(soundByte, pending);
		return pending;
	};

	const resume = async (ctx: AudioContext): Promise<boolean> => {
		if (ctx.state === "running") return true;
		try {
			await ctx.resume();
		} catch {
			return false;
		}
		return (ctx.state as AudioContextState) === "running";
	};

	const playSound = (soundByte: SoundByteID) => {
		const ctx = getContext();
		if (!ctx) return;
		void (async () => {
			const [buffer, running] = await Promise.all([
				loadBuffer(ctx, soundByte),
				resume(ctx),
			]);
			if (!buffer || !running) return;
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.connect(ctx.destination);
			source.start();
		})();
	};

	onMount(() => {
		const ctx = getContext();
		if (!ctx) return;

		for (const soundByte of Object.keys(SOUND_URLS) as Array<SoundByteID>) {
			void loadBuffer(ctx, soundByte);
		}

		const unlock = () => {
			void resume(ctx);
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") unlock();
		};

		for (const event of UNLOCK_EVENTS) {
			window.addEventListener(event, unlock, { capture: true, passive: true });
		}
		document.addEventListener("visibilitychange", handleVisibilityChange);

		onCleanup(() => {
			for (const event of UNLOCK_EVENTS) {
				window.removeEventListener(event, unlock, { capture: true });
			}
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			void ctx.close();
			context = undefined;
		});
	});

	const value = {
		playSound,
	};

	return (
		<SoundsContext.Provider value={value}>
			{props.children}
		</SoundsContext.Provider>
	);
};

export const useSounds = (): SoundsContextValue => {
	const ctx = useContext(SoundsContext);
	if (!ctx) throw new Error("useSounds called outside SoundsContextProvider");
	return ctx;
};

import { createContext, type ParentComponent, useContext } from "solid-js";

const SOUNDS = {
	mute: new Audio("/sounds/mute.mp3"),
	unmute: new Audio("/sounds/unmute.mp3"),
	deafen: new Audio("/sounds/deafen.mp3"),
	undeafen: new Audio("/sounds/undeafen.mp3"),
	screenShared: new Audio("/sounds/screen-shared.mp3"),
	screenUnshared: new Audio("/sounds/screen-unshared.mp3"),
	camOn: new Audio("/sounds/cam-on.mp3"),
	camOff: new Audio("/sounds/cam-off.mp3"),
	join: new Audio("/sounds/join.mp3"),
	leave: new Audio("/sounds/leave.mp3"),
	ping: new Audio("/sounds/ping.mp3"),
};

type SoundByteID = keyof typeof SOUNDS;

type SoundsContextValue = {
	playSound: (soundByte: SoundByteID) => void;
};

const SoundsContext = createContext<SoundsContextValue>();

export const SoundsContextProvider: ParentComponent = (props) => {
	const playSound = (soundByte: SoundByteID) => {
		const audio = SOUNDS[soundByte].cloneNode() as HTMLAudioElement;
		audio.play();
	};

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

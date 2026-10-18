export type PlaybackState = { time: number; playing: boolean };

type HandoffEvent = { kind: "claim" } | ({ kind: "release" } & PlaybackState);

const stash = new Map<string, PlaybackState>();
const listeners = new Map<string, Set<(event: HandoffEvent) => void>>();

const emit = (key: string, event: HandoffEvent) => {
	for (const listener of listeners.get(key) ?? []) listener(event);
};

export const stashPlayback = (key: string, state: PlaybackState) => {
	stash.set(key, state);
};

export const claimPlayback = (key: string) => {
	const state = stash.get(key);
	stash.delete(key);
	emit(key, { kind: "claim" });
	return state;
};

export const releasePlayback = (key: string, state: PlaybackState) => {
	emit(key, { kind: "release", ...state });
};

export const onPlaybackHandoff = (
	key: string,
	listener: (event: HandoffEvent) => void,
) => {
	let set = listeners.get(key);
	if (!set) {
		set = new Set();
		listeners.set(key, set);
	}
	set.add(listener);
	return () => {
		set?.delete(listener);
		if (set?.size === 0) listeners.delete(key);
	};
};

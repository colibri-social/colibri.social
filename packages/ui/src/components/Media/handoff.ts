export type PlaybackState = { time: number; playing: boolean };

type HandoffEvent = { kind: "claim" } | ({ kind: "release" } & PlaybackState);

const listeners = new Map<string, Set<(event: HandoffEvent) => void>>();

const emit = (key: string, event: HandoffEvent) => {
	for (const listener of listeners.get(key) ?? []) listener(event);
};

export const claimPlayback = (key: string) => {
	emit(key, { kind: "claim" });
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

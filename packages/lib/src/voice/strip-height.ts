export const MIN_VOICE_STRIP_HEIGHT = 64;
export const MAX_VOICE_STRIP_HEIGHT = 240;
export const DEFAULT_VOICE_STRIP_HEIGHT = 88;

export const clampStripHeight = (value: number) => {
	return Math.max(
		MIN_VOICE_STRIP_HEIGHT,
		Math.min(MAX_VOICE_STRIP_HEIGHT, Math.round(value)),
	);
};

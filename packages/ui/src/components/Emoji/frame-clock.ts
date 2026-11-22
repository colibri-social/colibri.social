export type FrameTimeline = { starts: number[]; loopMs: number };

const INSTANT_FRAME_MS = 10;
const DEFAULT_FRAME_MS = 100;

export const frameDelayMs = (durationUs: number | null | undefined) => {
	const ms = (durationUs ?? 0) / 1000;

	return ms <= INSTANT_FRAME_MS ? DEFAULT_FRAME_MS : ms;
};

export const frameTimeline = (delays: readonly number[]): FrameTimeline => {
	const starts: number[] = [];
	let loopMs = 0;

	for (const delay of delays) {
		starts.push(loopMs);
		loopMs += delay;
	}

	return { starts, loopMs };
};

export const frameAt = (timeline: FrameTimeline, now: number) => {
	const { starts, loopMs } = timeline;

	if (starts.length < 2 || loopMs <= 0) return 0;

	const time = ((now % loopMs) + loopMs) % loopMs;
	let low = 0;
	let high = starts.length - 1;

	while (low < high) {
		const middle = Math.ceil((low + high) / 2);

		if (starts[middle] <= time) low = middle;
		else high = middle - 1;
	}

	return low;
};

export const fitFrameSize = (
	width: number,
	height: number,
	maxSide: number,
) => {
	const scale = Math.min(1, maxSide / Math.max(width, height));

	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
};

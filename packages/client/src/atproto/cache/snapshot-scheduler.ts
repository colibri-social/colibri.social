export type SnapshotClock<H> = {
	now: () => number;
	setTimer: (fn: () => void, ms: number) => H;
	clearTimer: (handle: H) => void;
};

export type SnapshotScheduler<T> = {
	schedule: (payload: T) => void;
	flush: () => void;
};

export const realSnapshotClock: SnapshotClock<ReturnType<typeof setTimeout>> = {
	now: () => Date.now(),
	setTimer: (fn, ms) => setTimeout(fn, ms),
	clearTimer: (handle) => {
		clearTimeout(handle);
	},
};

export const createSnapshotScheduler = <T, H>(options: {
	maxIntervalMs: number;
	debounceMs: number;
	clock: SnapshotClock<H>;
	write: (payload: T) => void;
}): SnapshotScheduler<T> => {
	let timer: H | undefined;
	let pending: T | undefined;
	let lastWriteAt = 0;

	const flush = (): void => {
		if (timer !== undefined) {
			options.clock.clearTimer(timer);
			timer = undefined;
		}
		const queued = pending;
		if (queued === undefined) return;
		pending = undefined;
		lastWriteAt = options.clock.now();
		options.write(queued);
	};

	const schedule = (payload: T): void => {
		pending = payload;
		if (options.clock.now() - lastWriteAt >= options.maxIntervalMs) {
			flush();
			return;
		}
		if (timer !== undefined) options.clock.clearTimer(timer);
		timer = options.clock.setTimer(flush, options.debounceMs);
	};

	return { schedule, flush };
};

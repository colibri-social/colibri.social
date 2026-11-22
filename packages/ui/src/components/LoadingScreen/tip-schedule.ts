export type TipSchedule = {
	count: number;
	start: number;
	delay: number;
	interval: number;
};

export type TipSlot = {
	index: number | undefined;
	nextChangeIn: number | undefined;
};

const wrap = (value: number, count: number) =>
	((value % count) + count) % count;

export const tipSlotAt = (elapsed: number, schedule: TipSchedule): TipSlot => {
	const count = Math.max(0, Math.floor(schedule.count));
	if (count === 0) return { index: undefined, nextChangeIn: undefined };
	const delay = Math.max(0, schedule.delay);
	if (elapsed < delay) {
		return { index: undefined, nextChangeIn: delay - elapsed };
	}
	const interval = Math.max(1, schedule.interval);
	const shown = elapsed - delay;
	const step = Math.floor(shown / interval);
	return {
		index: wrap(Math.floor(schedule.start) + step, count),
		nextChangeIn: count > 1 ? interval * (step + 1) - shown : undefined,
	};
};

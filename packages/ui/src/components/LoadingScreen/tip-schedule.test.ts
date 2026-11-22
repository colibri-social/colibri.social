import { describe, expect, it } from "vitest";
import { tipSlotAt } from "./tip-schedule";

const schedule = { count: 3, start: 1, delay: 1000, interval: 5000 };

describe("tipSlotAt", () => {
	it("waits for the delay before showing the first tip", () => {
		expect(tipSlotAt(0, schedule)).toEqual({
			index: undefined,
			nextChangeIn: 1000,
		});
		expect(tipSlotAt(400, schedule)).toEqual({
			index: undefined,
			nextChangeIn: 600,
		});
	});

	it("starts at the given tip once the delay has passed", () => {
		expect(tipSlotAt(1000, schedule)).toEqual({ index: 1, nextChangeIn: 5000 });
		expect(tipSlotAt(3500, schedule)).toEqual({ index: 1, nextChangeIn: 2500 });
	});

	it("moves to the next tip every interval and wraps around", () => {
		expect(tipSlotAt(6000, schedule).index).toBe(2);
		expect(tipSlotAt(11_000, schedule).index).toBe(0);
		expect(tipSlotAt(16_000, schedule).index).toBe(1);
	});

	it("picks up where an earlier copy left off", () => {
		const first = tipSlotAt(7200, schedule);
		const remounted = tipSlotAt(7200, schedule);
		expect(remounted).toEqual(first);
		expect(first).toEqual({ index: 2, nextChangeIn: 3800 });
	});

	it("keeps a single tip without scheduling changes", () => {
		expect(tipSlotAt(60_000, { ...schedule, count: 1 })).toEqual({
			index: 0,
			nextChangeIn: undefined,
		});
	});

	it("shows nothing when there are no tips", () => {
		expect(tipSlotAt(60_000, { ...schedule, count: 0 })).toEqual({
			index: undefined,
			nextChangeIn: undefined,
		});
	});

	it("wraps a start outside the list into range", () => {
		expect(tipSlotAt(1000, { ...schedule, start: 7 }).index).toBe(1);
		expect(tipSlotAt(1000, { ...schedule, start: -1 }).index).toBe(2);
	});

	it("shows the first tip right away without a delay", () => {
		expect(tipSlotAt(0, { ...schedule, delay: 0 })).toEqual({
			index: 1,
			nextChangeIn: 5000,
		});
	});
});

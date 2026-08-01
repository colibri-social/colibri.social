import { describe, expect, it } from "vitest";
import {
	createSnapshotScheduler,
	type SnapshotClock,
} from "./snapshot-scheduler";

const MAX_INTERVAL_MS = 5000;
const DEBOUNCE_MS = 400;

const createFakeClock = () => {
	let time = 1_000_000;
	let nextId = 1;
	const timers = new Map<number, { at: number; fn: () => void }>();

	const clock: SnapshotClock<number> = {
		now: () => time,
		setTimer: (fn, ms) => {
			const id = nextId++;
			timers.set(id, { at: time + ms, fn });
			return id;
		},
		clearTimer: (handle) => {
			timers.delete(handle);
		},
	};

	const advance = (ms: number) => {
		const target = time + ms;
		for (;;) {
			let dueId: number | undefined;
			let dueAt = Number.POSITIVE_INFINITY;
			for (const [id, timer] of timers) {
				if (timer.at <= target && timer.at < dueAt) {
					dueId = id;
					dueAt = timer.at;
				}
			}
			if (dueId === undefined) break;
			const due = timers.get(dueId);
			timers.delete(dueId);
			time = dueAt;
			due?.fn();
		}
		time = target;
	};

	return { clock, advance, at: () => time };
};

const createHarness = () => {
	const { clock, advance, at } = createFakeClock();
	const writes: Array<{ payload: string; at: number }> = [];
	const scheduler = createSnapshotScheduler<string, number>({
		maxIntervalMs: MAX_INTERVAL_MS,
		debounceMs: DEBOUNCE_MS,
		clock,
		write: (payload) => {
			writes.push({ payload, at: at() });
		},
	});
	return { scheduler, writes, advance, at };
};

describe("createSnapshotScheduler", () => {
	it("writes the first snapshot immediately", () => {
		const { scheduler, writes } = createHarness();

		scheduler.schedule("a");

		expect(writes.map((w) => w.payload)).toEqual(["a"]);
	});

	it("defers a snapshot scheduled shortly after a write", () => {
		const { scheduler, writes, advance } = createHarness();

		scheduler.schedule("a");
		advance(100);
		scheduler.schedule("b");

		expect(writes).toHaveLength(1);

		advance(DEBOUNCE_MS);

		expect(writes.map((w) => w.payload)).toEqual(["a", "b"]);
	});

	it("keeps writing under sustained traffic faster than the debounce", () => {
		const { scheduler, writes, advance } = createHarness();
		const start = 1_000_000;

		for (let i = 0; i < 120; i++) {
			scheduler.schedule(`m${i}`);
			advance(100);
		}

		expect(writes.length).toBeGreaterThan(1);

		let previous = start;
		for (const write of writes) {
			expect(write.at - previous).toBeLessThanOrEqual(
				MAX_INTERVAL_MS + DEBOUNCE_MS,
			);
			previous = write.at;
		}
	});

	it("writes the trailing snapshot once traffic stops", () => {
		const { scheduler, writes, advance } = createHarness();

		scheduler.schedule("a");
		for (let i = 0; i < 5; i++) {
			advance(100);
			scheduler.schedule(`b${i}`);
		}
		advance(DEBOUNCE_MS);

		expect(writes.at(-1)?.payload).toBe("b4");
	});

	it("coalesces to the latest payload while deferring", () => {
		const { scheduler, writes, advance } = createHarness();

		scheduler.schedule("a");
		advance(50);
		scheduler.schedule("b");
		advance(50);
		scheduler.schedule("c");
		advance(DEBOUNCE_MS);

		expect(writes.map((w) => w.payload)).toEqual(["a", "c"]);
	});

	it("flushes a deferred snapshot on demand", () => {
		const { scheduler, writes, advance } = createHarness();

		scheduler.schedule("a");
		advance(50);
		scheduler.schedule("b");
		scheduler.flush();

		expect(writes.map((w) => w.payload)).toEqual(["a", "b"]);
	});

	it("does not write again after a flush cancelled the timer", () => {
		const { scheduler, writes, advance } = createHarness();

		scheduler.schedule("a");
		advance(50);
		scheduler.schedule("b");
		scheduler.flush();
		advance(DEBOUNCE_MS * 5);

		expect(writes).toHaveLength(2);
	});

	it("is a no-op when flushing with nothing pending", () => {
		const { scheduler, writes } = createHarness();

		scheduler.flush();

		expect(writes).toHaveLength(0);
	});
});

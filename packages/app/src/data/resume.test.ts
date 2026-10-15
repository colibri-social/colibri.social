import { describe, expect, it } from "vitest";
import {
	createCatchUpQueue,
	type ResumeEnvironment,
	watchResume,
} from "./resume";

const fakeEnvironment = () => {
	const document = new EventTarget();
	const window = new EventTarget();
	let visible = true;
	let now = 0;
	const environment: ResumeEnvironment = {
		document,
		window,
		visible: () => visible,
		now: () => now,
	};
	return {
		environment,
		hide: () => {
			visible = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},
		show: () => {
			visible = true;
			document.dispatchEvent(new Event("visibilitychange"));
		},
		pageshow: () => window.dispatchEvent(new Event("pageshow")),
		pagehide: () => window.dispatchEvent(new Event("pagehide")),
		advance: (ms: number) => {
			now += ms;
		},
	};
};

const deferred = () => {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe("watchResume", () => {
	it("resumes once after a long enough absence, however many wake events fire", () => {
		const fake = fakeEnvironment();
		let resumed = 0;
		let suspended = 0;
		const stop = watchResume({
			environment: fake.environment,
			afterMs: 5_000,
			onResume: () => {
				resumed += 1;
			},
			onSuspend: () => {
				suspended += 1;
			},
		});
		fake.pagehide();
		fake.hide();
		fake.advance(6_000);
		fake.show();
		fake.pageshow();
		expect(suspended).toBe(1);
		expect(resumed).toBe(1);
		stop();
	});

	it("ignores a short absence", () => {
		const fake = fakeEnvironment();
		let resumed = 0;
		const stop = watchResume({
			environment: fake.environment,
			afterMs: 5_000,
			onResume: () => {
				resumed += 1;
			},
		});
		fake.hide();
		fake.advance(2_000);
		fake.show();
		expect(resumed).toBe(0);
		fake.hide();
		fake.advance(5_000);
		fake.show();
		expect(resumed).toBe(1);
		stop();
	});

	it("stops listening once disposed", () => {
		const fake = fakeEnvironment();
		let resumed = 0;
		const stop = watchResume({
			environment: fake.environment,
			onResume: () => {
				resumed += 1;
			},
		});
		stop();
		fake.hide();
		fake.advance(60_000);
		fake.show();
		expect(resumed).toBe(0);
	});
});

describe("createCatchUpQueue", () => {
	it("runs at most the configured number of tasks at a time", async () => {
		const queue = createCatchUpQueue({ concurrency: 2 });
		let running = 0;
		let peak = 0;
		const done: number[] = [];
		const tasks = Array.from({ length: 5 }, (_, index) => async () => {
			running += 1;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, 5));
			running -= 1;
			done.push(index);
		});
		await queue.run(tasks);
		expect(peak).toBe(2);
		expect(done.sort()).toEqual([0, 1, 2, 3, 4]);
	});

	it("starts no further tasks once cancelled", async () => {
		const queue = createCatchUpQueue({ concurrency: 1 });
		const gate = deferred();
		const started: number[] = [];
		const run = queue.run(
			[0, 1, 2].map((index) => async () => {
				started.push(index);
				await gate.promise;
			}),
		);
		queue.cancel();
		gate.resolve();
		await run;
		expect(started).toEqual([0]);
	});

	it("keeps going after a task fails", async () => {
		const queue = createCatchUpQueue({ concurrency: 1 });
		const started: number[] = [];
		await queue.run([
			async () => {
				started.push(0);
				throw new Error("offline");
			},
			async () => {
				started.push(1);
			},
		]);
		expect(started).toEqual([0, 1]);
	});
});

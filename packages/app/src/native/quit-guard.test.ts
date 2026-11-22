import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBeforeExit, setBeforeExit } from "./quit-guard";

describe("runBeforeExit", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("waits for the registered work", async () => {
		let finish: () => void = () => {};
		const clear = setBeforeExit(
			() => new Promise<void>((resolve) => (finish = resolve)),
		);
		let done = false;
		const running = runBeforeExit(4_500).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(1_000);
		expect(done).toBe(false);
		finish();
		await running;
		expect(done).toBe(true);
		clear();
	});

	it("stops waiting at the deadline", async () => {
		const clear = setBeforeExit(() => new Promise(() => {}));
		let done = false;
		const running = runBeforeExit(4_500).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(4_499);
		expect(done).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await running;
		expect(done).toBe(true);
		clear();
	});

	it("keeps a newer registration when an older session clears", async () => {
		const older = vi.fn(async () => {});
		const newer = vi.fn(async () => {});
		const clearOlder = setBeforeExit(older);
		const clearNewer = setBeforeExit(newer);
		clearOlder();
		await runBeforeExit();
		expect(older).not.toHaveBeenCalled();
		expect(newer).toHaveBeenCalledOnce();
		clearNewer();
	});

	it("resolves at once with nothing registered", async () => {
		await expect(runBeforeExit()).resolves.toBeUndefined();
	});
});

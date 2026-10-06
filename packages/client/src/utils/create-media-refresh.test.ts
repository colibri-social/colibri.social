import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createMediaRefresh from "./create-media-refresh";

type Listener = () => void;

const fakeTarget = () => {
	const listeners = new Map<string, Set<Listener>>();
	return {
		addEventListener: (type: string, listener: Listener) => {
			const set = listeners.get(type) ?? new Set<Listener>();
			set.add(listener);
			listeners.set(type, set);
		},
		removeEventListener: (type: string, listener: Listener) => {
			listeners.get(type)?.delete(listener);
		},
		dispatch: (type: string) => {
			for (const listener of [...(listeners.get(type) ?? [])]) listener();
		},
		count: (type: string) => listeners.get(type)?.size ?? 0,
	};
};

const NOW_MS = 1_800_000_000_000;

describe("createMediaRefresh", () => {
	let doc: ReturnType<typeof fakeTarget> & { visibilityState: string };
	let win: ReturnType<typeof fakeTarget>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW_MS);
		doc = Object.assign(fakeTarget(), { visibilityState: "visible" });
		win = fakeTarget();
		vi.stubGlobal("document", doc);
		vi.stubGlobal("window", win);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("refreshes once the due time arrives", () => {
		const refresh = vi.fn();
		const dispose = createRoot((dispose) => {
			createMediaRefresh(() => NOW_MS + 60_000, refresh);
			return dispose;
		});

		vi.advanceTimersByTime(59_999);
		expect(refresh).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(refresh).toHaveBeenCalledTimes(1);
		dispose();
	});

	it("reschedules when the due time moves", () => {
		const refresh = vi.fn();
		const [dueAt, setDueAt] = createSignal<number | undefined>(NOW_MS + 1000);
		const dispose = createRoot((dispose) => {
			createMediaRefresh(dueAt, refresh);
			return dispose;
		});

		setDueAt(NOW_MS + 5000);
		vi.advanceTimersByTime(1000);
		expect(refresh).not.toHaveBeenCalled();
		vi.advanceTimersByTime(4000);
		expect(refresh).toHaveBeenCalledTimes(1);

		setDueAt(undefined);
		vi.advanceTimersByTime(60_000);
		expect(refresh).toHaveBeenCalledTimes(1);
		dispose();
	});

	it("catches up when the page becomes visible after the timer was throttled", async () => {
		const refresh = vi.fn();
		const dispose = createRoot((dispose) => {
			createMediaRefresh(() => NOW_MS - 1, refresh);
			return dispose;
		});
		await vi.advanceTimersByTimeAsync(0);
		refresh.mockClear();

		doc.visibilityState = "hidden";
		doc.dispatch("visibilitychange");
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).not.toHaveBeenCalled();

		doc.visibilityState = "visible";
		doc.dispatch("visibilitychange");
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(1);

		win.dispatch("focus");
		await vi.advanceTimersByTimeAsync(0);
		expect(refresh).toHaveBeenCalledTimes(2);
		dispose();
	});

	it("does not start a second refresh while one is running", async () => {
		let finish: () => void = () => {};
		const refresh = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		const dispose = createRoot((dispose) => {
			createMediaRefresh(() => NOW_MS - 1, refresh);
			return dispose;
		});

		win.dispatch("focus");
		win.dispatch("focus");
		expect(refresh).toHaveBeenCalledTimes(1);

		finish();
		await vi.waitFor(() => {
			win.dispatch("focus");
			expect(refresh).toHaveBeenCalledTimes(2);
		});
		dispose();
	});

	it("drops its timer and listeners on cleanup", () => {
		const refresh = vi.fn();
		const dispose = createRoot((dispose) => {
			createMediaRefresh(() => NOW_MS + 1000, refresh);
			return dispose;
		});

		dispose();
		vi.advanceTimersByTime(5000);
		expect(refresh).not.toHaveBeenCalled();
		expect(doc.count("visibilitychange")).toBe(0);
		expect(win.count("focus")).toBe(0);
	});
});

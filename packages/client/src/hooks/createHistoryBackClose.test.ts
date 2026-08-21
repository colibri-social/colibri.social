import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHistoryBackClose } from "./createHistoryBackClose";

type Handler = (event: unknown) => void;

const MARKER = "colibriOverlay";

const createFakeHistory = () => {
	const stack: Array<Record<string, unknown> | null> = [null];
	let index = 0;
	const listeners = new Set<Handler>();
	const traversals: Array<() => void> = [];

	const navigateBack = () => {
		if (index > 0) index -= 1;
		for (const listener of [...listeners]) listener({});
	};

	const history = {
		get state() {
			return stack[index];
		},
		pushState: (state: Record<string, unknown> | null) => {
			stack.splice(index + 1);
			stack.push(state);
			index = stack.length - 1;
		},
		back: () => {
			traversals.push(navigateBack);
		},
	};

	const window = {
		addEventListener: (type: string, handler: Handler) => {
			if (type === "popstate") listeners.add(handler);
		},
		removeEventListener: (type: string, handler: Handler) => {
			if (type === "popstate") listeners.delete(handler);
		},
		setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
	};

	vi.stubGlobal("history", history);
	vi.stubGlobal("window", window);

	const deliver = () => {
		const pending = traversals.splice(0);
		for (const traversal of pending) traversal();
	};

	return {
		deliver,
		navigateBack,
		pending: () => traversals.length,
		marker: () => history.state?.[MARKER],
		depth: () => index,
	};
};

const tick = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createHistoryBackClose", () => {
	it("pushes an entry while open and unwinds it on close", async () => {
		const fake = createFakeHistory();

		await createRoot(async (dispose) => {
			const [open, setOpen] = createSignal(false);
			createHistoryBackClose(open, () => {});

			setOpen(true);
			await tick();
			expect(fake.depth()).toBe(1);
			expect(typeof fake.marker()).toBe("number");

			setOpen(false);
			await tick();
			expect(fake.pending()).toBe(1);

			fake.deliver();
			expect(fake.depth()).toBe(0);

			dispose();
		});
	});

	it("closes the overlay on a back navigation without unwinding twice", async () => {
		const fake = createFakeHistory();
		const onBack = vi.fn();

		await createRoot(async (dispose) => {
			const [open, setOpen] = createSignal(false);
			createHistoryBackClose(open, () => {
				onBack();
				setOpen(false);
			});

			setOpen(true);
			await tick();

			fake.navigateBack();
			expect(onBack).toHaveBeenCalledTimes(1);

			await tick();
			expect(fake.pending()).toBe(0);

			dispose();
		});
	});

	it("does not let a closing overlay's traversal pop the next overlay's entry", async () => {
		const fake = createFakeHistory();
		const onBackFirst = vi.fn();
		const onBackSecond = vi.fn();

		await createRoot(async (dispose) => {
			const [first, setFirst] = createSignal(false);
			const [second, setSecond] = createSignal(false);
			createHistoryBackClose(first, onBackFirst);
			createHistoryBackClose(second, onBackSecond);

			setFirst(true);
			await tick();
			const firstMarker = fake.marker();

			setFirst(false);
			await tick();
			expect(fake.pending()).toBe(1);

			setSecond(true);
			await tick();
			expect(fake.marker()).toBe(firstMarker);

			fake.deliver();
			await tick();

			expect(onBackSecond).not.toHaveBeenCalled();
			expect(onBackFirst).not.toHaveBeenCalled();
			expect(fake.depth()).toBe(1);
			expect(fake.marker()).not.toBe(firstMarker);
			expect(typeof fake.marker()).toBe("number");

			setSecond(false);
			await tick();
			fake.deliver();
			expect(fake.depth()).toBe(0);

			dispose();
		});
	});
});

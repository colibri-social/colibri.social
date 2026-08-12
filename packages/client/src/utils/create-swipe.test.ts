import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSwipe } from "./create-swipe";

type Handler = (event: unknown) => void;

const createFakeElement = () => {
	const handlers = new Map<string, Set<Handler>>();

	const element = {
		clientWidth: 400,
		addEventListener: (type: string, handler: Handler) => {
			const set = handlers.get(type) ?? new Set<Handler>();
			set.add(handler);
			handlers.set(type, set);
		},
		removeEventListener: (type: string, handler: Handler) => {
			handlers.get(type)?.delete(handler);
		},
	};

	const dispatch = (type: string, event: Record<string, unknown>) => {
		for (const handler of [...(handlers.get(type) ?? [])]) handler(event);
	};

	return { element: element as unknown as HTMLElement, dispatch, handlers };
};

const pointer = (x: number, extra: Record<string, unknown> = {}) => ({
	clientX: x,
	clientY: 0,
	pointerType: "touch",
	stopPropagation: () => {},
	...extra,
});

const stubFrames = () => {
	const queued = new Map<number, FrameRequestCallback>();
	let nextId = 1;

	vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
		const id = nextId++;
		queued.set(id, cb);
		return id;
	});
	const cancel = vi.fn((id: number) => queued.delete(id));
	vi.stubGlobal("cancelAnimationFrame", cancel);

	const flush = () => {
		const pending = [...queued.entries()];
		queued.clear();
		for (const [, cb] of pending) cb(0);
	};

	return { flush, cancel, pending: () => queued.size };
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createSwipe drag coalescing", () => {
	it("delivers at most one move per frame, carrying the newest position", () => {
		const frames = stubFrames();
		const { element, dispatch } = createFakeElement();
		const onSwipeMove = vi.fn();

		createRoot(() => {
			createSwipe(element, { onSwipeRight: () => {}, onSwipeMove });

			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointermove", pointer(30));
			dispatch("pointermove", pointer(50));
			dispatch("pointermove", pointer(80));

			expect(onSwipeMove).not.toHaveBeenCalled();
			expect(frames.pending()).toBe(1);

			frames.flush();

			expect(onSwipeMove).toHaveBeenCalledTimes(1);
			expect(onSwipeMove).toHaveBeenCalledWith(80);
		});
	});

	it("schedules a fresh frame once the previous one has run", () => {
		const frames = stubFrames();
		const { element, dispatch } = createFakeElement();
		const onSwipeMove = vi.fn();

		createRoot(() => {
			createSwipe(element, { onSwipeRight: () => {}, onSwipeMove });

			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointermove", pointer(30));
			frames.flush();
			dispatch("pointermove", pointer(60));
			frames.flush();

			expect(onSwipeMove.mock.calls).toEqual([[30], [60]]);
		});
	});

	it("releases synchronously and drops the queued move", () => {
		const frames = stubFrames();
		const { element, dispatch } = createFakeElement();
		const onSwipeMove = vi.fn();
		const onSwipeRight = vi.fn();

		createRoot(() => {
			createSwipe(element, {
				onSwipeRight,
				onSwipeMove,
				commitRatio: 0.45,
			});

			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointermove", pointer(300));
			dispatch("pointerup", pointer(300));

			expect(onSwipeRight).toHaveBeenCalledTimes(1);
			expect(onSwipeMove).toHaveBeenCalledTimes(1);
			expect(onSwipeMove).toHaveBeenCalledWith(null);

			frames.flush();

			expect(onSwipeMove).toHaveBeenCalledTimes(1);
		});
	});

	it("cancels a queued move when the owner is disposed", () => {
		const frames = stubFrames();
		const { element, dispatch } = createFakeElement();
		const onSwipeMove = vi.fn();

		const dispose = createRoot((disposeRoot) => {
			createSwipe(element, { onSwipeRight: () => {}, onSwipeMove });
			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointermove", pointer(30));
			return disposeRoot;
		});

		dispose();

		expect(frames.cancel).toHaveBeenCalled();
		frames.flush();
		expect(onSwipeMove).not.toHaveBeenCalled();
	});
});

describe("createSwipe click suppression", () => {
	it("swallows the click synthesized after a claimed gesture", () => {
		stubFrames();
		const { element, dispatch, handlers } = createFakeElement();

		createRoot(() => {
			createSwipe(element, { onSwipeRight: () => {}, onSwipeMove: () => {} });

			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointermove", pointer(300));
			dispatch("pointerup", pointer(300));

			expect(handlers.get("click")?.size).toBe(1);

			const preventDefault = vi.fn();
			const stopPropagation = vi.fn();
			dispatch("click", { preventDefault, stopPropagation });

			expect(preventDefault).toHaveBeenCalledTimes(1);
			expect(stopPropagation).toHaveBeenCalledTimes(1);
		});
	});

	it("retires an unused suppressor when the next gesture starts", () => {
		stubFrames();
		const { element, dispatch, handlers } = createFakeElement();

		createRoot(() => {
			createSwipe(element, { onSwipeRight: () => {}, onSwipeMove: () => {} });

			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointermove", pointer(300));
			dispatch("pointerup", pointer(300));
			expect(handlers.get("click")?.size).toBe(1);

			dispatch("pointerdown", pointer(0, { target: element }));
			expect(handlers.get("click")?.size).toBe(0);

			const preventDefault = vi.fn();
			dispatch("click", { preventDefault, stopPropagation: () => {} });
			expect(preventDefault).not.toHaveBeenCalled();
		});
	});

	it("leaves a tap that never became a swipe alone", () => {
		stubFrames();
		const { element, dispatch, handlers } = createFakeElement();

		createRoot(() => {
			createSwipe(element, { onSwipeRight: () => {}, onSwipeMove: () => {} });

			dispatch("pointerdown", pointer(0, { target: element }));
			dispatch("pointerup", pointer(0));

			expect(handlers.get("click")?.size ?? 0).toBe(0);
		});
	});
});

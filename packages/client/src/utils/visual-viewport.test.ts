import { createEffect, createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createViewportMetrics,
	shellHeightForInset,
	type ViewportMetrics,
} from "./visual-viewport";

const INNER_HEIGHT = 900;

type StubWindow = EventTarget & { innerHeight: number };

const stubWindow = (): StubWindow => {
	const target = Object.assign(new EventTarget(), {
		innerHeight: INNER_HEIGHT,
		setTimeout: () => 0,
		clearTimeout: () => {},
	});
	vi.stubGlobal("window", target);
	return target;
};

const trackHeight = (): {
	metrics: ViewportMetrics;
	seen: Array<number | undefined>;
	dispose: () => void;
} => {
	const seen: Array<number | undefined> = [];
	let metrics: ViewportMetrics | undefined;

	const dispose = createRoot((disposeRoot) => {
		metrics = createViewportMetrics();
		const tracked = metrics;
		createEffect(() => {
			seen.push(tracked.height());
		});
		return disposeRoot;
	});

	if (!metrics) throw new Error("metrics were not created");

	return { metrics, seen, dispose };
};

const nativeInset = (inset: number): CustomEvent =>
	new CustomEvent("colibri-keyboard-inset", { detail: inset });

const springInset = (inset: number): CustomEvent =>
	new CustomEvent("colibri-keyboard-inset", {
		detail: {
			inset,
			duration: 250,
			mass: 3,
			stiffness: 1000,
			damping: 500,
			velocity: 0,
			latency: 4,
			at: 0,
		},
	});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createViewportMetrics", () => {
	it("notifies height consumers when a native keyboard inset arrives", () => {
		const win = stubWindow();
		const { metrics, seen, dispose } = trackHeight();

		expect(seen).toEqual([undefined]);

		win.dispatchEvent(nativeInset(320));

		expect(seen).toEqual([undefined, shellHeightForInset(320)]);
		expect(metrics.keyboardInset()).toBe(320);

		dispose();
	});

	it("returns the shell height back to full when the keyboard closes", () => {
		const win = stubWindow();
		const { seen, dispose } = trackHeight();

		win.dispatchEvent(nativeInset(320));
		win.dispatchEvent(nativeInset(0));

		expect(seen).toEqual([
			undefined,
			shellHeightForInset(320),
			shellHeightForInset(0),
		]);

		dispose();
	});

	it("ignores a repeated inset of the same size", () => {
		const win = stubWindow();
		const { seen, dispose } = trackHeight();

		win.dispatchEvent(nativeInset(320));
		win.dispatchEvent(nativeInset(320));

		expect(seen).toHaveLength(2);

		dispose();
	});

	it("clamps an inset that claims more than 70% of the window", () => {
		const win = stubWindow();
		const { metrics, dispose } = trackHeight();

		win.dispatchEvent(nativeInset(INNER_HEIGHT));

		expect(metrics.keyboardInset()).toBe(INNER_HEIGHT * 0.7);

		dispose();
	});

	it("only builds a keyboard transition for insets that carry spring params", () => {
		const win = stubWindow();
		const { metrics, dispose } = trackHeight();

		win.dispatchEvent(nativeInset(320));
		expect(metrics.keyboardTransition()).toBeUndefined();
		expect(metrics.keyboardAnimating()).toBe(false);

		win.dispatchEvent(springInset(0));

		const transition = metrics.keyboardTransition();
		expect(transition).toBeDefined();
		expect(transition?.fromInset).toBe(320);
		expect(transition?.toInset).toBe(0);
		expect(transition?.durationMs).toBe(250);
		expect(transition?.samples).toHaveLength(60);
		expect(metrics.keyboardAnimating()).toBe(true);

		dispose();
	});
});

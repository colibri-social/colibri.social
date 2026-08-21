// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	anchoredScrollTop,
	captureAnchor,
	createMessageScrollController,
	type FrameScheduler,
	type MessageScrollController,
} from "./message-scroll";
import {
	bindScrollGestures,
	createDomScrollSurface,
} from "./message-scroll-dom";

type RowSpec = { uri?: string; height: number };

const CLIENT_HEIGHT = 600;

const makeSpecs = (prefix: string, count: number, height: number): RowSpec[] =>
	Array.from({ length: count }, (_, index) => ({
		uri: `at://${prefix}-${index}`,
		height,
	}));

const define = (element: HTMLElement, values: Record<string, number>): void => {
	for (const [name, value] of Object.entries(values))
		Object.defineProperty(element, name, { value, configurable: true });
};

const createFakeScheduler = () => {
	let next = 1;
	const queue = new Map<number, () => void>();

	const scheduler: FrameScheduler = {
		request: (callback) => {
			const handle = next++;
			queue.set(handle, callback);
			return handle;
		},
		cancel: (handle) => {
			queue.delete(handle);
		},
	};

	return {
		scheduler,
		pending: () => queue.size,
		flush: (count = 1) => {
			let ran = 0;
			for (let index = 0; index < count; index++) {
				const entry = queue.entries().next().value;
				if (!entry) break;
				queue.delete(entry[0]);
				entry[1]();
				ran++;
			}
			return ran;
		},
	};
};

const createRecordingController = (): MessageScrollController & {
	calls: Array<string>;
} => {
	const calls: Array<string> = [];
	let gesturing = false;

	return {
		calls,
		isPinned: () => true,
		isGesturing: () => gesturing,
		isSettling: () => false,
		isAtBottom: () => true,
		distanceFromBottom: () => 0,
		anchorMode: () => "none",
		pin: () => {},
		unpin: () => {},
		reset: () => {},
		assert: () => false,
		settle: () => {},
		captureRowAnchor: () => {},
		absorbGrowth: () => {},
		absorbPrepend: () => true,
		beginGesture: () => {
			gesturing = true;
			calls.push("begin");
		},
		endGesture: () => {
			if (!gesturing) return;
			gesturing = false;
			calls.push("end");
		},
		cancelGesture: () => {
			if (!gesturing) return;
			gesturing = false;
			calls.push("cancel");
		},
		handleScroll: () => {},
		dispose: () => {},
	};
};

const createFixture = (specs: RowSpec[]) => {
	document.body.innerHTML = "";
	const container = document.createElement("div");
	const content = document.createElement("div");
	container.append(content);
	document.body.append(container);

	let scrollTop = 0;
	Object.defineProperty(container, "scrollTop", {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			const max = Math.max(0, container.scrollHeight - CLIENT_HEIGHT);
			scrollTop = Math.min(Math.max(value, 0), max);
		},
	});

	const layout = (): void => {
		let top = 0;
		for (const node of Array.from(content.children)) {
			if (!(node instanceof HTMLElement)) continue;
			const height = Number(node.dataset.testHeight ?? 0);
			define(node, { offsetTop: top, offsetHeight: height });
			top += height;
		}
		define(container, { scrollHeight: top, clientHeight: CLIENT_HEIGHT });
	};

	const rowFor = (spec: RowSpec): HTMLElement => {
		const row = document.createElement("div");
		row.dataset.testHeight = String(spec.height);
		if (spec.uri === undefined) return row;

		const relative = document.createElement("div");
		const message = document.createElement("div");
		message.setAttribute("data-message-uri", spec.uri);
		define(message, { offsetTop: 0, offsetHeight: spec.height });
		relative.append(message);
		row.append(relative);
		return row;
	};

	for (const spec of specs) content.append(rowFor(spec));
	layout();

	return {
		container,
		surface: createDomScrollSurface(
			() => container,
			() => content,
		),
		scrollTo: (value: number): void => {
			container.scrollTop = value;
		},
		prepend: (incoming: RowSpec[]): void => {
			content.prepend(...incoming.map(rowFor));
			layout();
		},
	};
};

describe("createDomScrollSurface", () => {
	it("resolves the row key from the nested message element", () => {
		const { surface } = createFixture(makeSpecs("m", 3, 100));

		expect(surface.rowKey(0)).toBe("at://m-0");
		expect(surface.rowKey(2)).toBe("at://m-2");
	});

	it("leaves divider rows keyless", () => {
		const { surface } = createFixture([
			{ height: 24 },
			{ uri: "at://m-0", height: 100 },
		]);

		expect(surface.rowKey(0)).toBeUndefined();
		expect(surface.rowKey(1)).toBe("at://m-0");
	});

	it("measures the row rather than the nested message element", () => {
		const { surface, scrollTo } = createFixture(makeSpecs("m", 20, 100));
		scrollTo(250);

		expect(surface.rowOffsetOfKey("at://m-3")).toBe(50);
		expect(surface.rowOffsetOfKey("at://m-3")).toBe(surface.rowOffset(3));
	});

	it("reports no offset for a key that is not mounted", () => {
		const { surface } = createFixture(makeSpecs("m", 3, 100));

		expect(surface.rowOffsetOfKey("at://gone")).toBeUndefined();
	});

	it("anchors a real row so a prepend restores the exact position", () => {
		const { surface, scrollTo, prepend } = createFixture(
			makeSpecs("m", 20, 100),
		);
		scrollTo(0);

		const anchor = captureAnchor(surface);
		expect(anchor.mode).toBe("row");

		prepend(makeSpecs("older", 50, 100));

		expect(anchoredScrollTop(surface, anchor)).toBe(5000);
	});

	it("keeps anchoring across a prepend when the reader sits mid-list", () => {
		const { surface, scrollTo, prepend } = createFixture(
			makeSpecs("m", 20, 100),
		);
		scrollTo(640);

		const anchor = captureAnchor(surface);
		prepend(makeSpecs("older", 10, 100));

		expect(anchoredScrollTop(surface, anchor)).toBe(1640);
	});
});

describe("bindScrollGestures", () => {
	it("ends the gesture when a wheel tick lands after the last scroll event", () => {
		const { container } = createFixture(makeSpecs("m", 20, 100));
		const controller = createRecordingController();
		const unbind = bindScrollGestures(container, controller);

		container.dispatchEvent(new Event("wheel"));
		container.dispatchEvent(new Event("scroll"));
		container.dispatchEvent(new Event("wheel"));
		container.dispatchEvent(new Event("scrollend"));

		expect(controller.calls).toContain("end");
		expect(controller.calls).not.toContain("cancel");
		unbind();
	});

	it("ends the gesture when a held arrow key stops moving the surface", () => {
		const { container } = createFixture(makeSpecs("m", 20, 100));
		const controller = createRecordingController();
		const unbind = bindScrollGestures(container, controller);

		container.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
		);
		container.dispatchEvent(new Event("scroll"));
		container.dispatchEvent(
			new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
		);
		container.dispatchEvent(new Event("scrollend"));

		expect(controller.calls).toContain("end");
		expect(controller.calls).not.toContain("cancel");
		unbind();
	});

	it("cancels a gesture that never scrolled", () => {
		const { container } = createFixture(makeSpecs("m", 20, 100));
		const controller = createRecordingController();
		const unbind = bindScrollGestures(container, controller);

		container.dispatchEvent(new Event("pointerdown"));
		container.dispatchEvent(new Event("pointerup"));

		expect(controller.calls).toEqual(["begin", "cancel"]);
		unbind();
	});

	it("ignores keys that do not scroll", () => {
		const { container } = createFixture(makeSpecs("m", 20, 100));
		const controller = createRecordingController();
		const unbind = bindScrollGestures(container, controller);

		container.dispatchEvent(
			new KeyboardEvent("keydown", { key: "a", bubbles: true }),
		);

		expect(controller.calls).toEqual([]);
		unbind();
	});

	it("ignores scroll events outside a gesture", () => {
		const { container } = createFixture(makeSpecs("m", 20, 100));
		const controller = createRecordingController();
		const unbind = bindScrollGestures(container, controller);

		container.dispatchEvent(new Event("scroll"));
		container.dispatchEvent(new Event("scrollend"));

		expect(controller.calls).toEqual([]);
		unbind();
	});

	it("stops listening once unbound", () => {
		const { container } = createFixture(makeSpecs("m", 20, 100));
		const controller = createRecordingController();
		bindScrollGestures(container, controller)();

		container.dispatchEvent(new Event("wheel"));

		expect(controller.calls).toEqual([]);
	});

	it("keeps the reader at the top of a channel that barely overflows", () => {
		const fixture = createFixture([
			...makeSpecs("m", 6, 100),
			{ uri: "at://m-6", height: 25 },
		]);
		const frames = createFakeScheduler();
		const controller = createMessageScrollController(fixture.surface, {
			scheduler: frames.scheduler,
		});
		const unbind = bindScrollGestures(fixture.container, controller);

		fixture.scrollTo(25);
		expect(controller.isPinned()).toBe(true);

		fixture.container.dispatchEvent(new Event("wheel"));
		fixture.scrollTo(0);
		fixture.container.dispatchEvent(new Event("scroll"));
		fixture.container.dispatchEvent(new Event("wheel"));
		fixture.container.dispatchEvent(new Event("scrollend"));
		frames.flush(5);

		expect(controller.isPinned()).toBe(false);
		expect(fixture.container.scrollTop).toBe(0);
		unbind();
	});
});

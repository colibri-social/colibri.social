import { describe, expect, it } from "vitest";
import {
	captureAnchor,
	createMessageScrollController,
	decideGrowthSide,
	distanceFromBottom,
	type FrameScheduler,
	findAnchorRow,
	findTopmostVisibleRow,
	hasPinIntent,
	isPinnedToBottom,
	pinIntentThreshold,
	prefetchDistance,
	type ScrollSurface,
	shouldLoadOlder,
	shouldShowJumpToLatest,
} from "./message-scroll";

type FakeRow = { key?: string; height: number };

const makeRows = (prefix: string, count: number, height: number): FakeRow[] =>
	Array.from({ length: count }, (_, index) => ({
		key: `${prefix}-${index}`,
		height,
	}));

const barelyOverflowingRows = (tail = 25): FakeRow[] => [
	...makeRows("m", 6, 100),
	{ key: "m-6", height: tail },
];

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

const createFakeSurface = (
	initial: FakeRow[],
	initialClientHeight: number,
	options: { subPixelMax?: boolean } = {},
) => {
	let rows = [...initial];
	let scrollTop = 0;
	let clientHeight = initialClientHeight;

	const scrollHeight = () => rows.reduce((total, row) => total + row.height, 0);
	const maxScrollTop = () => {
		const max = Math.max(0, scrollHeight() - clientHeight);
		return options.subPixelMax ? Math.max(0, max - 0.4) : max;
	};
	const offsetTop = (index: number) =>
		rows.slice(0, index).reduce((total, row) => total + row.height, 0);
	const indexOfKey = (key: string) =>
		rows.findIndex((candidate) => candidate.key === key);

	const surface: ScrollSurface = {
		getScrollTop: () => scrollTop,
		setScrollTop: (value) => {
			scrollTop = Math.min(Math.max(value, 0), maxScrollTop());
		},
		getScrollHeight: scrollHeight,
		getClientHeight: () => clientHeight,
		rowCount: () => rows.length,
		rowOffset: (index) => offsetTop(index) - scrollTop,
		rowHeight: (index) => rows[index]?.height ?? 0,
		rowKey: (index) => rows[index]?.key,
		rowOffsetOfKey: (key) => {
			const index = indexOfKey(key);
			return index === -1 ? undefined : offsetTop(index) - scrollTop;
		},
	};

	return {
		surface,
		clientHeight: () => clientHeight,
		resizeViewport: (value: number) => {
			clientHeight = value;
		},
		scrollTo: (value: number) => surface.setScrollTop(value),
		scrollTop: () => scrollTop,
		scrollHeight,
		offsetOf: (key: string) => surface.rowOffsetOfKey(key),
		prepend: (incoming: FakeRow[]) => {
			rows = [...incoming, ...rows];
		},
		append: (incoming: FakeRow[]) => {
			rows = [...rows, ...incoming];
		},
		insertAt: (index: number, incoming: FakeRow[]) => {
			rows = [...rows.slice(0, index), ...incoming, ...rows.slice(index)];
		},
		grow: (key: string, by: number) => {
			const row = rows.find((candidate) => candidate.key === key);
			if (row) row.height += by;
		},
		remove: (key: string) => {
			rows = rows.filter((candidate) => candidate.key !== key);
		},
		replace: (incoming: FakeRow[]) => {
			rows = [...incoming];
			scrollTop = Math.min(scrollTop, maxScrollTop());
		},
	};
};

const createHarness = (
	initial: FakeRow[],
	clientHeight: number,
	options: { subPixelMax?: boolean } = {},
) => {
	const fake = createFakeSurface(initial, clientHeight, options);
	const frames = createFakeScheduler();
	const controller = createMessageScrollController(fake.surface, {
		scheduler: frames.scheduler,
	});
	return { fake, frames, controller };
};

describe("findTopmostVisibleRow", () => {
	it("finds the first row crossing the container top edge", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(450);

		expect(findTopmostVisibleRow(fake.surface)).toBe(4);
	});

	it("returns the first row when scrolled to the very top", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);

		expect(findTopmostVisibleRow(fake.surface)).toBe(0);
	});

	it("reports no row when the list is empty", () => {
		const fake = createFakeSurface([], 600);

		expect(findTopmostVisibleRow(fake.surface)).toBe(-1);
	});

	it("agrees with a linear scan across every scroll position", () => {
		const fake = createFakeSurface(
			makeRows("m", 40, 30).map((row, index) => ({
				...row,
				height: 20 + (index % 7) * 25,
			})),
			500,
		);

		for (let top = 0; top < fake.scrollHeight() - 500; top += 13) {
			fake.scrollTo(top);
			const expected = Array.from({ length: 40 }, (_, i) => i).find(
				(i) => fake.surface.rowOffset(i) + fake.surface.rowHeight(i) > 0,
			);
			expect(findTopmostVisibleRow(fake.surface)).toBe(expected);
		}
	});
});

describe("findAnchorRow", () => {
	it("prefers the first row starting at or below the container top", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(250);

		expect(findAnchorRow(fake.surface)).toBe(3);
		expect(findTopmostVisibleRow(fake.surface)).toBe(2);
	});

	it("falls back to the straddling row when one row fills the viewport", () => {
		const fake = createFakeSurface(
			[
				{ key: "a", height: 100 },
				{ key: "tall", height: 2000 },
				{ key: "c", height: 100 },
			],
			600,
		);
		fake.scrollTo(300);

		expect(findAnchorRow(fake.surface)).toBe(1);
	});
});

describe("captureAnchor", () => {
	it("records a row anchor wherever the reader is parked", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(1300);

		expect(captureAnchor(fake.surface).mode).toBe("row");
	});

	it("records no anchor for an empty list", () => {
		const fake = createFakeSurface([], 600);

		expect(captureAnchor(fake.surface).mode).toBe("none");
	});

	it("never anchors to a row without a key", () => {
		const fake = createFakeSurface(
			[
				{ height: 100 },
				{ height: 100 },
				{ key: "m-0", height: 100 },
				{ key: "m-1", height: 100 },
			],
			600,
		);

		const anchor = captureAnchor(fake.surface);
		expect(anchor.mode).toBe("row");
		if (anchor.mode !== "row") return;
		expect(anchor.candidates.map((candidate) => candidate.key)).toEqual([
			"m-0",
			"m-1",
		]);
	});

	it("keeps several fallback candidates so a deletion cannot orphan it", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(500);

		const anchor = captureAnchor(fake.surface);
		if (anchor.mode !== "row") throw new Error("expected a row anchor");
		expect(anchor.candidates.length).toBeGreaterThan(1);
	});
});

describe("isPinnedToBottom", () => {
	it("reports pinned inside the threshold", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(1350);

		expect(isPinnedToBottom(fake.surface)).toBe(true);
	});

	it("reports unpinned outside the threshold", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(1300);

		expect(isPinnedToBottom(fake.surface)).toBe(false);
	});
});

describe("pinIntentThreshold", () => {
	it("keeps the absolute threshold on a deep list", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);

		expect(pinIntentThreshold(fake.surface)).toBe(80);
	});

	it("halves a range shorter than the absolute threshold", () => {
		const fake = createFakeSurface(barelyOverflowingRows(), 600);

		expect(pinIntentThreshold(fake.surface)).toBe(12.5);
	});

	it("keeps the absolute threshold when the content fits the viewport", () => {
		const fake = createFakeSurface(makeRows("m", 2, 100), 600);

		expect(pinIntentThreshold(fake.surface)).toBe(80);
	});

	it("never reports less than a pixel", () => {
		const fake = createFakeSurface(barelyOverflowingRows(1), 600);

		expect(pinIntentThreshold(fake.surface)).toBe(1);
	});
});

describe("hasPinIntent", () => {
	it("reads the top of a channel that barely overflows as scrolled away", () => {
		const fake = createFakeSurface(barelyOverflowingRows(), 600);
		fake.scrollTo(0);

		expect(isPinnedToBottom(fake.surface)).toBe(true);
		expect(hasPinIntent(fake.surface)).toBe(false);
	});

	it("reads the bottom of a channel that barely overflows as pinned", () => {
		const fake = createFakeSurface(barelyOverflowingRows(), 600);
		fake.scrollTo(fake.scrollHeight());

		expect(hasPinIntent(fake.surface)).toBe(true);
	});

	it("matches the absolute threshold on a deep list", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);

		fake.scrollTo(3340);
		expect(hasPinIntent(fake.surface)).toBe(true);

		fake.scrollTo(3300);
		expect(hasPinIntent(fake.surface)).toBe(false);
	});

	it("treats content shorter than the viewport as pinned", () => {
		const fake = createFakeSurface(makeRows("m", 2, 100), 600);
		fake.scrollTo(0);

		expect(hasPinIntent(fake.surface)).toBe(true);
	});
});

describe("row anchoring", () => {
	it("compensates growth inside the straddling row above the fold", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(250);

		controller.unpin();
		const before = fake.offsetOf("m-3");

		fake.grow("m-2", 400);
		controller.assert();

		expect(fake.offsetOf("m-3")).toBe(before);
		expect(fake.scrollTop()).toBe(650);
	});

	it("keeps the anchored row in place when older messages are prepended", () => {
		const { fake, controller } = createHarness(makeRows("old", 20, 100), 600);
		fake.scrollTo(250);

		controller.unpin();
		const before = fake.offsetOf("old-2");

		fake.prepend(makeRows("older", 50, 100));
		controller.assert();

		expect(fake.offsetOf("old-2")).toBe(before);
		expect(fake.scrollTop()).toBe(5250);
	});

	it("keeps the anchored row in place when content above it grows later", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		const before = fake.offsetOf("m-20");

		fake.grow("m-3", 450);
		controller.assert();

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2450);
	});

	it("survives a prepend followed by async growth inside the prepended page", () => {
		const { fake, controller } = createHarness(makeRows("old", 20, 100), 600);
		fake.scrollTo(150);

		controller.unpin();
		const before = fake.offsetOf("old-1");

		fake.prepend(makeRows("older", 50, 100));
		controller.assert();

		fake.grow("older-4", 320);
		controller.assert();
		fake.grow("older-40", 180);
		controller.assert();

		expect(fake.offsetOf("old-1")).toBe(before);
	});

	it("leaves growth below the anchor alone", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();

		fake.grow("m-35", 500);
		controller.assert();

		expect(fake.scrollTop()).toBe(2000);
	});

	it("does not yank a scrolled-up reader to the bottom when a message arrives", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		controller.unpin();

		fake.append(makeRows("new", 2, 100));
		controller.assert();

		expect(fake.scrollTop()).toBe(1500);
	});

	it("holds the surviving neighbour when the anchored row is deleted", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		controller.unpin();
		const before = fake.offsetOf("m-16");

		fake.remove("m-15");
		controller.assert();

		expect(fake.offsetOf("m-16")).toBe(before);
	});

	it("holds position when every anchor candidate is deleted", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		controller.unpin();

		for (let index = 15; index < 25; index++) fake.remove(`m-${index}`);
		controller.assert();

		expect(fake.scrollTop()).toBe(1500);
		expect(controller.anchorMode()).toBe("row");
	});

	it("compensates a deletion above a scrolled-up reader", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		const before = fake.offsetOf("m-20");

		fake.remove("m-3");
		controller.assert();

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(1900);
	});

	it("ignores the scroll event caused by its own correction", () => {
		const { fake, controller } = createHarness(makeRows("old", 20, 100), 600);
		fake.scrollTo(250);

		controller.unpin();

		fake.prepend(makeRows("older", 50, 100));
		controller.assert();
		controller.handleScroll();

		fake.grow("older-2", 200);
		controller.assert();

		expect(fake.offsetOf("old-2")).toBe(-50);
	});

	it("re-anchors to the reader's new position after a real scroll", () => {
		const { fake, controller } = createHarness(makeRows("m", 60, 100), 600);
		fake.scrollTo(3000);

		controller.unpin();

		fake.scrollTo(900);
		controller.handleScroll();

		fake.grow("m-2", 250);
		controller.assert();

		expect(fake.scrollTop()).toBe(1150);
		expect(fake.offsetOf("m-9")).toBe(0);
	});
});

describe("pin intent", () => {
	it("starts pinned and stays at the bottom as messages arrive", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);

		fake.append(makeRows("new", 3, 100));
		controller.assert();

		expect(controller.isPinned()).toBe(true);
		expect(controller.isAtBottom()).toBe(true);
	});

	it("stays pinned while media below the fold finishes loading", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);
		fake.scrollTo(fake.scrollHeight());

		fake.grow("m-19", 400);
		controller.assert();

		expect(controller.isAtBottom()).toBe(true);
	});

	it("does not unpin on a bare scroll event far from the bottom", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);

		fake.scrollTo(1000);
		controller.handleScroll();

		expect(controller.isPinned()).toBe(true);

		controller.assert();
		expect(controller.isAtBottom()).toBe(true);
	});

	it("unpins once a user gesture settles away from the bottom", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);

		controller.beginGesture();
		fake.scrollTo(1000);
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(false);

		fake.append(makeRows("new", 2, 100));
		controller.assert();
		expect(fake.scrollTop()).toBe(1000);
	});

	it("re-pins when a user gesture settles inside the threshold", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);

		controller.beginGesture();
		fake.scrollTo(1000);
		controller.handleScroll();
		controller.endGesture();
		expect(controller.isPinned()).toBe(false);

		controller.beginGesture();
		fake.scrollTo(fake.scrollHeight() - 600 - 40);
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(true);
	});

	it("leaves pin state alone for a tap that never scrolls", () => {
		const { controller } = createHarness(makeRows("m", 40, 100), 600);

		controller.beginGesture();
		controller.cancelGesture();

		expect(controller.isPinned()).toBe(true);
	});

	it("writes the raw scroll height so a fractional maximum still lands", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600, {
			subPixelMax: true,
		});
		fake.scrollTo(0);

		controller.pin(false);

		expect(controller.distanceFromBottom()).toBeLessThan(1);
	});

	it("stays unpinned at the top of a channel that barely overflows", () => {
		const { fake, frames, controller } = createHarness(
			barelyOverflowingRows(),
			600,
		);
		controller.pin(false);

		controller.beginGesture();
		fake.scrollTo(0);
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(false);
		expect(frames.pending()).toBe(0);

		frames.flush(5);
		expect(fake.scrollTop()).toBe(0);
	});

	it("re-pins at the bottom of a channel that barely overflows", () => {
		const { fake, controller } = createHarness(barelyOverflowingRows(), 600);

		controller.beginGesture();
		fake.scrollTo(0);
		controller.handleScroll();
		controller.endGesture();
		expect(controller.isPinned()).toBe(false);

		controller.beginGesture();
		fake.scrollTo(fake.scrollHeight());
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(true);
	});

	it("re-pins at a fractional bottom of a channel that barely overflows", () => {
		const { fake, controller } = createHarness(barelyOverflowingRows(), 600, {
			subPixelMax: true,
		});

		controller.beginGesture();
		fake.scrollTo(fake.scrollHeight());
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(true);
	});

	it("re-pins when the scrollable range is thinner than the pin floor", () => {
		const { fake, controller } = createHarness(
			barelyOverflowingRows(0.8),
			600,
			{
				subPixelMax: true,
			},
		);

		controller.beginGesture();
		fake.scrollTo(fake.scrollHeight());
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(true);
	});

	it("keeps following the bottom when the content is shorter than the viewport", () => {
		const { fake, controller } = createHarness(makeRows("m", 2, 100), 600);

		controller.beginGesture();
		fake.scrollTo(0);
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(true);
	});

	it("does not yank a reader parked at the top of a short channel when a message arrives", () => {
		const { fake, controller } = createHarness(barelyOverflowingRows(), 600);
		controller.pin(false);

		controller.beginGesture();
		fake.scrollTo(0);
		controller.handleScroll();
		controller.endGesture();

		fake.append(makeRows("new", 1, 40));
		controller.assert();

		expect(fake.scrollTop()).toBe(0);
	});

	it("keeps read marking generous while a whole short channel is on screen", () => {
		const { fake, controller } = createHarness(barelyOverflowingRows(), 600);

		controller.beginGesture();
		fake.scrollTo(0);
		controller.handleScroll();
		controller.endGesture();

		expect(controller.isPinned()).toBe(false);
		expect(controller.isAtBottom()).toBe(true);
	});
});

describe("channel switch", () => {
	it("re-pins a controller that the previous channel left unpinned", () => {
		const { fake, controller } = createHarness(makeRows("a", 40, 100), 600);

		controller.beginGesture();
		fake.scrollTo(1000);
		controller.handleScroll();
		controller.endGesture();
		expect(controller.isPinned()).toBe(false);

		controller.reset();
		expect(controller.isPinned()).toBe(true);
		expect(controller.anchorMode()).toBe("none");

		fake.replace(makeRows("b", 30, 100));
		controller.assert();

		expect(controller.isAtBottom()).toBe(true);
	});

	it("drops the row anchor so the new list is not aligned to old keys", () => {
		const { fake, controller } = createHarness(makeRows("a", 40, 100), 600);
		fake.scrollTo(1000);
		controller.unpin();
		expect(controller.anchorMode()).toBe("row");

		controller.reset();
		fake.replace(makeRows("b", 40, 100));
		controller.assert();

		expect(controller.isAtBottom()).toBe(true);
	});

	it("clears a gesture the previous channel left armed", () => {
		const { fake, frames, controller } = createHarness(
			makeRows("a", 40, 100),
			600,
		);

		controller.beginGesture();
		expect(controller.isGesturing()).toBe(true);

		controller.reset();
		expect(controller.isGesturing()).toBe(false);

		fake.replace(makeRows("b", 30, 100));
		controller.pin();
		frames.flush(4);

		expect(controller.isAtBottom()).toBe(true);
	});

	it("cancels a settle loop left over from the previous channel", () => {
		const { frames, controller } = createHarness(makeRows("a", 40, 100), 600);

		controller.settle();
		expect(controller.isSettling()).toBe(true);

		controller.reset();

		expect(controller.isSettling()).toBe(false);
		expect(frames.pending()).toBe(0);
	});
});

describe("viewport resize", () => {
	it("keeps a pinned reader at the bottom when the composer grows", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);

		fake.resizeViewport(572);
		controller.assert();

		expect(controller.distanceFromBottom()).toBe(0);
	});

	it("keeps a pinned reader at the bottom across a keyboard-sized shrink", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);

		fake.resizeViewport(300);
		controller.assert();

		expect(controller.distanceFromBottom()).toBe(0);
	});

	it("holds a scrolled-up reader still when the viewport shrinks", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		controller.unpin();
		const before = fake.offsetOf("m-15");

		fake.resizeViewport(300);
		controller.assert();

		expect(fake.offsetOf("m-15")).toBe(before);
		expect(fake.scrollTop()).toBe(1500);
	});

	it("re-pins across a shrink and grow cycle", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);

		fake.resizeViewport(300);
		controller.assert();
		fake.resizeViewport(600);
		controller.assert();

		expect(controller.distanceFromBottom()).toBe(0);
	});
});

describe("settle loop", () => {
	it("chases growth across frames while pinned", () => {
		const { fake, frames, controller } = createHarness(
			makeRows("m", 20, 100),
			600,
		);

		controller.settle();
		for (let index = 0; index < 5; index++) {
			fake.grow("m-19", 100);
			frames.flush(1);
		}

		expect(controller.distanceFromBottom()).toBe(0);
	});

	it("stops once the content is stable", () => {
		const { frames, controller } = createHarness(makeRows("m", 20, 100), 600);

		controller.settle();
		frames.flush(10);

		expect(frames.pending()).toBe(0);
		expect(controller.isSettling()).toBe(false);
	});

	it("stops at the frame budget under endless growth", () => {
		const { fake, frames, controller } = createHarness(
			makeRows("m", 20, 100),
			600,
		);

		controller.settle({ maxFrames: 5 });
		for (let index = 0; index < 20; index++) {
			fake.grow("m-19", 50);
			frames.flush(1);
		}

		expect(frames.pending()).toBe(0);
	});

	it("keeps running past stability while hold is true", () => {
		const { frames, controller } = createHarness(makeRows("m", 20, 100), 600);

		controller.settle({ maxFrames: 8, hold: () => true });
		frames.flush(20);

		expect(frames.pending()).toBe(0);
	});

	it("is cancelled by a user gesture", () => {
		const { fake, frames, controller } = createHarness(
			makeRows("m", 40, 100),
			600,
		);

		controller.settle();
		frames.flush(1);

		controller.beginGesture();
		fake.scrollTo(1000);
		frames.flush(10);

		expect(fake.scrollTop()).toBe(1000);
	});

	it("does not arm while the reader is unpinned", () => {
		const { fake, frames, controller } = createHarness(
			makeRows("m", 40, 100),
			600,
		);
		fake.scrollTo(1000);

		controller.unpin();
		controller.settle();

		expect(frames.pending()).toBe(0);
	});
});

describe("distanceFromBottom", () => {
	it("reports no gap when the content is shorter than the viewport", () => {
		const fake = createFakeSurface(makeRows("m", 2, 100), 600);

		expect(distanceFromBottom(fake.surface)).toBe(0);
	});

	it("tracks the gap as the reader scrolls", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		expect(distanceFromBottom(fake.surface)).toBe(1900);
	});

	it("reports no gap after pinning to the bottom", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(0);

		controller.pin(false);

		expect(controller.distanceFromBottom()).toBe(0);
	});

	it("grows when a message arrives below a scrolled-up reader", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		controller.unpin();
		const before = controller.distanceFromBottom();

		fake.append(makeRows("new", 3, 100));
		controller.assert();

		expect(fake.scrollTop()).toBe(1500);
		expect(controller.distanceFromBottom()).toBe(before + 300);
	});

	it("grows when the viewport shrinks under a scrolled-up reader", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		controller.unpin();
		const before = controller.distanceFromBottom();

		fake.resizeViewport(300);

		expect(controller.distanceFromBottom()).toBe(before + 300);
	});
});

describe("shouldShowJumpToLatest", () => {
	it("stays hidden at the bottom", () => {
		expect(shouldShowJumpToLatest(0, false)).toBe(false);
	});

	it("stays hidden inside the dead band when not already visible", () => {
		expect(shouldShowJumpToLatest(100, false)).toBe(false);
	});

	it("shows once the reader passes the show distance", () => {
		expect(shouldShowJumpToLatest(250, false)).toBe(true);
	});

	it("stays visible inside the dead band once shown", () => {
		expect(shouldShowJumpToLatest(100, true)).toBe(true);
	});

	it("hides only below the pin threshold", () => {
		expect(shouldShowJumpToLatest(79, true)).toBe(false);
		expect(shouldShowJumpToLatest(80, true)).toBe(true);
	});
});

describe("decideGrowthSide", () => {
	it("holds everything visible when the growth is above the fold", () => {
		expect(decideGrowthSide(-200, 600)).toBe("lower");
	});

	it("holds the top when the growth is below the fold", () => {
		expect(decideGrowthSide(700, 600)).toBe("upper");
	});

	it("holds the lower side when the growth is near the top of the screen", () => {
		expect(decideGrowthSide(150, 600)).toBe("lower");
	});

	it("holds the upper side when the growth is near the bottom of the screen", () => {
		expect(decideGrowthSide(450, 600)).toBe("upper");
	});

	it("keeps the top still on an exact tie", () => {
		expect(decideGrowthSide(300, 600)).toBe("upper");
	});
});

describe("absorbGrowth", () => {
	it("holds content below a growth that lands near the top of the screen", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		const before = fake.offsetOf("m-25");

		const boundary = fake.offsetOf("m-21") ?? 0;
		fake.grow("m-21", 300);
		controller.absorbGrowth(boundary, 300);

		expect(fake.offsetOf("m-25")).toBe(before);
		expect(fake.scrollTop()).toBe(2300);
	});

	it("holds content above a growth that lands near the bottom of the screen", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		const before = fake.offsetOf("m-20");

		const boundary = fake.offsetOf("m-25") ?? 0;
		fake.grow("m-25", 300);
		controller.absorbGrowth(boundary, 300);

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2000);
	});

	it("still compensates growth entirely above the fold", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		const before = fake.offsetOf("m-20");

		const boundary = fake.offsetOf("m-3") ?? 0;
		fake.grow("m-3", 400);
		controller.absorbGrowth(boundary, 400);

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2400);
	});

	it("keeps the bottom pinned regardless of where the growth landed", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);
		fake.scrollTo(fake.scrollHeight());

		const boundary = fake.offsetOf("m-16") ?? 0;
		fake.grow("m-16", 250);
		controller.absorbGrowth(boundary, 250);

		expect(controller.isAtBottom()).toBe(true);
	});

	it("absorbs growth above the fold while a gesture is running", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		controller.beginGesture();
		const before = fake.offsetOf("m-20");

		const boundary = fake.offsetOf("m-3") ?? 0;
		fake.grow("m-3", 400);
		controller.absorbGrowth(boundary, 400);

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2400);
	});

	it("leaves growth the reader can see alone while a gesture is running", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();
		controller.beginGesture();

		const boundary = fake.offsetOf("m-25") ?? 0;
		fake.grow("m-25", 300);
		controller.absorbGrowth(boundary, 300);

		expect(fake.scrollTop()).toBe(2000);
	});

	it("re-anchors after holding the lower side so the next growth is measured fresh", () => {
		const { fake, controller } = createHarness(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		controller.unpin();

		const firstBoundary = fake.offsetOf("m-21") ?? 0;
		fake.grow("m-21", 300);
		controller.absorbGrowth(firstBoundary, 300);

		const before = fake.offsetOf("m-30");
		fake.grow("m-10", 200);
		controller.assert();

		expect(fake.offsetOf("m-30")).toBe(before);
	});
});

describe("absorbPrepend", () => {
	it("holds the reading position when a page lands mid-gesture", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);
		fake.scrollTo(0);
		controller.unpin();

		controller.beginGesture();
		controller.captureRowAnchor();
		const before = fake.offsetOf("m-0");
		fake.prepend(makeRows("older", 50, 100));

		expect(controller.absorbPrepend()).toBe(true);
		expect(fake.offsetOf("m-0")).toBe(before);
		expect(fake.scrollTop()).toBe(5000);
	});

	it("does not fall back to the bottom when the pin flag is stale", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);
		fake.scrollTo(0);

		controller.beginGesture();
		controller.captureRowAnchor();
		fake.prepend(makeRows("older", 50, 100));

		expect(controller.isPinned()).toBe(true);
		expect(controller.absorbPrepend()).toBe(true);
		expect(fake.scrollTop()).toBe(5000);
		expect(controller.isAtBottom()).toBe(false);
	});

	it("holds the top of a short channel when a page adds no height", () => {
		const { fake, controller } = createHarness(barelyOverflowingRows(), 600);
		fake.scrollTo(0);
		controller.unpin();

		controller.captureRowAnchor();
		fake.prepend([{ key: "older-0", height: 0 }]);

		expect(controller.absorbPrepend()).toBe(true);
		expect(fake.scrollTop()).toBe(0);
	});

	it("counts a page that added no height as compensated", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);
		fake.scrollTo(400);
		controller.unpin();

		controller.captureRowAnchor();

		expect(controller.absorbPrepend()).toBe(true);
		expect(fake.scrollTop()).toBe(400);
	});

	it("reports a failure when no anchored row can be resolved", () => {
		const keyless = Array.from({ length: 20 }, () => ({ height: 100 }));
		const { fake, controller } = createHarness(keyless, 600);
		fake.scrollTo(0);
		controller.unpin();

		controller.captureRowAnchor();
		fake.prepend(Array.from({ length: 50 }, () => ({ height: 100 })));

		expect(controller.absorbPrepend()).toBe(false);
		expect(fake.scrollTop()).toBe(0);
	});

	it("keeps the bottom when the reader is genuinely at the bottom", () => {
		const { fake, controller } = createHarness(makeRows("m", 20, 100), 600);
		fake.scrollTo(fake.scrollHeight());

		controller.captureRowAnchor();
		fake.prepend(makeRows("older", 50, 100));

		expect(controller.absorbPrepend()).toBe(true);
		expect(controller.isAtBottom()).toBe(true);
	});

	it("stops the prefetch chain when a page could not be compensated", () => {
		const keyless = Array.from({ length: 20 }, () => ({ height: 100 }));
		const { fake, controller } = createHarness(keyless, 600);
		fake.scrollTo(0);
		controller.unpin();

		let loads = 0;
		let compensated = true;

		while (
			compensated &&
			shouldLoadOlder({
				scrollTop: fake.scrollTop(),
				clientHeight: fake.clientHeight(),
				hasMore: true,
				loading: false,
				ready: true,
			})
		) {
			loads += 1;
			if (loads > 5) break;
			controller.captureRowAnchor();
			fake.prepend(Array.from({ length: 50 }, () => ({ height: 100 })));
			compensated = controller.absorbPrepend();
		}

		expect(loads).toBe(1);
	});
});

describe("shouldLoadOlder", () => {
	const base = {
		scrollTop: 0,
		clientHeight: 600,
		hasMore: true,
		loading: false,
		ready: true,
	};

	it("fires within a viewport of the top", () => {
		expect(shouldLoadOlder({ ...base, scrollTop: 500 })).toBe(true);
	});

	it("stays quiet further down the list", () => {
		expect(shouldLoadOlder({ ...base, scrollTop: 900 })).toBe(false);
	});

	it("stays quiet while a page is already in flight", () => {
		expect(shouldLoadOlder({ ...base, loading: true })).toBe(false);
	});

	it("stays quiet once the channel start is reached", () => {
		expect(shouldLoadOlder({ ...base, hasMore: false })).toBe(false);
	});

	it("stays quiet before the initial scroll has landed", () => {
		expect(shouldLoadOlder({ ...base, ready: false })).toBe(false);
	});

	it("keeps a floor under the trigger distance on short viewports", () => {
		expect(prefetchDistance(100)).toBe(400);
		expect(prefetchDistance(900)).toBe(900);
	});
});

describe("prefetch loop", () => {
	it("loads exactly one page when a prepend clears the trigger distance", () => {
		const { fake, controller } = createHarness(makeRows("old", 20, 100), 600);
		fake.scrollTo(0);
		controller.unpin();

		let loads = 0;
		let generation = 0;

		while (
			shouldLoadOlder({
				scrollTop: fake.scrollTop(),
				clientHeight: fake.clientHeight(),
				hasMore: true,
				loading: false,
				ready: true,
			})
		) {
			loads += 1;
			if (loads > 5) break;
			controller.captureRowAnchor();
			fake.prepend(makeRows(`page${generation++}`, 50, 100));
			controller.assert();
		}

		expect(loads).toBe(1);
		expect(fake.scrollTop()).toBe(5000);
	});

	it("re-arms once the reader scrolls back up into the trigger zone", () => {
		const fake = createFakeSurface(makeRows("m", 100, 100), 600);
		fake.scrollTo(5000);

		const state = {
			clientHeight: fake.clientHeight(),
			hasMore: true,
			loading: false,
			ready: true,
		};

		expect(shouldLoadOlder({ ...state, scrollTop: fake.scrollTop() })).toBe(
			false,
		);

		fake.scrollTo(200);
		expect(shouldLoadOlder({ ...state, scrollTop: fake.scrollTop() })).toBe(
			true,
		);
	});

	it("keeps filling while a short page leaves the reader in the trigger zone", () => {
		const { fake, controller } = createHarness(makeRows("old", 20, 100), 600);
		fake.scrollTo(0);
		controller.unpin();

		let loads = 0;

		while (
			shouldLoadOlder({
				scrollTop: fake.scrollTop(),
				clientHeight: fake.clientHeight(),
				hasMore: true,
				loading: false,
				ready: true,
			})
		) {
			loads += 1;
			if (loads > 20) break;
			controller.captureRowAnchor();
			fake.prepend(makeRows(`page${loads}`, 2, 100));
			controller.assert();
		}

		expect(loads).toBe(3);
		expect(fake.scrollTop()).toBe(600);
	});
});

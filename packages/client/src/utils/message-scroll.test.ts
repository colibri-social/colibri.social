import { describe, expect, it } from "vitest";
import {
	captureAnchor,
	createScrollAnchor,
	decideGrowthSide,
	findAnchorRow,
	findTopmostVisibleRow,
	prefetchDistance,
	type ScrollSurface,
	shouldLoadOlder,
} from "./message-scroll";

type FakeRow = { key: string; height: number };

const makeRows = (prefix: string, count: number, height: number): FakeRow[] =>
	Array.from({ length: count }, (_, index) => ({
		key: `${prefix}-${index}`,
		height,
	}));

const createFakeSurface = (initial: FakeRow[], clientHeight: number) => {
	let rows = [...initial];
	let scrollTop = 0;

	const scrollHeight = () => rows.reduce((total, row) => total + row.height, 0);
	const maxScrollTop = () => Math.max(0, scrollHeight() - clientHeight);
	const offsetTop = (index: number) =>
		rows.slice(0, index).reduce((total, row) => total + row.height, 0);

	const surface: ScrollSurface = {
		getScrollTop: () => scrollTop,
		setScrollTop: (value) => {
			scrollTop = Math.min(Math.max(value, 0), maxScrollTop());
		},
		getScrollHeight: scrollHeight,
		getClientHeight: () => clientHeight,
		rowCount: () => rows.length,
		rowAt: (index) => rows[index]?.key,
		rowOffset: (index) => offsetTop(index) - scrollTop,
		rowHeight: (index) => rows[index]?.height ?? 0,
		rowOffsetOf: (row) => {
			const index = rows.findIndex((candidate) => candidate.key === row);
			return index === -1 ? undefined : offsetTop(index) - scrollTop;
		},
	};

	return {
		surface,
		clientHeight,
		scrollTo: (value: number) => surface.setScrollTop(value),
		scrollTop: () => scrollTop,
		scrollHeight,
		offsetOf: (key: string) => surface.rowOffsetOf(key),
		prepend: (incoming: FakeRow[]) => {
			rows = [...incoming, ...rows];
		},
		append: (incoming: FakeRow[]) => {
			rows = [...rows, ...incoming];
		},
		grow: (key: string, by: number) => {
			const row = rows.find((candidate) => candidate.key === key);
			if (row) row.height += by;
		},
		remove: (key: string) => {
			rows = rows.filter((candidate) => candidate.key !== key);
		},
	};
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

describe("scroll anchor", () => {
	it("compensates growth inside the straddling row above the fold", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(250);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("m-3");

		fake.grow("m-2", 400);
		anchor.restore();

		expect(fake.offsetOf("m-3")).toBe(before);
		expect(fake.scrollTop()).toBe(650);
	});

	it("pins to the bottom before anything has captured an anchor", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(0);

		const anchor = createScrollAnchor(fake.surface);
		fake.append(makeRows("late", 30, 100));
		anchor.restore();

		expect(anchor.isAtBottom()).toBe(true);
	});

	it("stays pinned while content streams in during the initial load", () => {
		const fake = createFakeSurface(makeRows("m", 5, 100), 600);
		const anchor = createScrollAnchor(fake.surface);

		for (let index = 0; index < 10; index += 1) {
			fake.grow(`m-${index % 5}`, 200);
			anchor.restore();
		}

		expect(anchor.isAtBottom()).toBe(true);
	});

	it("keeps the anchored row in place when older messages are prepended", () => {
		const fake = createFakeSurface(makeRows("old", 20, 100), 600);
		fake.scrollTo(250);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("old-2");

		fake.prepend(makeRows("older", 50, 100));
		anchor.restore();

		expect(fake.offsetOf("old-2")).toBe(before);
		expect(fake.scrollTop()).toBe(5250);
	});

	it("keeps the anchored row in place when content above it grows later", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("m-20");

		fake.grow("m-3", 450);
		anchor.restore();

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2450);
	});

	it("survives a prepend followed by async growth inside the prepended page", () => {
		const fake = createFakeSurface(makeRows("old", 20, 100), 600);
		fake.scrollTo(150);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("old-1");

		fake.prepend(makeRows("older", 50, 100));
		anchor.restore();

		fake.grow("older-4", 320);
		anchor.restore();
		fake.grow("older-40", 180);
		anchor.restore();

		expect(fake.offsetOf("old-1")).toBe(before);
	});

	it("leaves growth below the anchor alone", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		fake.grow("m-35", 500);
		anchor.restore();

		expect(fake.scrollTop()).toBe(2000);
	});

	it("stays pinned to the bottom as new messages arrive", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(fake.scrollHeight());

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		expect(anchor.anchorMode()).toBe("bottom");

		fake.append(makeRows("new", 3, 100));
		anchor.restore();

		expect(anchor.isAtBottom()).toBe(true);
	});

	it("stays pinned to the bottom while media below the fold finishes loading", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(fake.scrollHeight());

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		fake.grow("m-19", 400);
		anchor.restore();

		expect(anchor.isAtBottom()).toBe(true);
	});

	it("does not yank a scrolled-up reader to the bottom when a message arrives", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		fake.append(makeRows("new", 2, 100));
		anchor.restore();

		expect(fake.scrollTop()).toBe(1500);
	});

	it("holds position when the anchored row disappears", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(1500);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		fake.remove("m-15");
		anchor.restore();

		expect(fake.scrollTop()).toBe(1500);
	});

	it("ignores the scroll event caused by its own correction", () => {
		const fake = createFakeSurface(makeRows("old", 20, 100), 600);
		fake.scrollTo(250);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		fake.prepend(makeRows("older", 50, 100));
		anchor.restore();
		anchor.handleScroll();

		fake.grow("older-2", 200);
		anchor.restore();

		expect(fake.offsetOf("old-2")).toBe(-50);
	});

	it("re-anchors to the reader's new position after a real scroll", () => {
		const fake = createFakeSurface(makeRows("m", 60, 100), 600);
		fake.scrollTo(3000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		fake.scrollTo(900);
		anchor.handleScroll();

		fake.grow("m-2", 250);
		anchor.restore();

		expect(fake.scrollTop()).toBe(1150);
		expect(fake.offsetOf("m-9")).toBe(0);
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
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("m-25");

		const boundary = fake.offsetOf("m-21") ?? 0;
		fake.grow("m-21", 300);
		anchor.absorbGrowth(boundary, 300);

		expect(fake.offsetOf("m-25")).toBe(before);
		expect(fake.scrollTop()).toBe(2300);
	});

	it("holds content above a growth that lands near the bottom of the screen", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("m-20");

		const boundary = fake.offsetOf("m-25") ?? 0;
		fake.grow("m-25", 300);
		anchor.absorbGrowth(boundary, 300);

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2000);
	});

	it("still compensates growth entirely above the fold", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();
		const before = fake.offsetOf("m-20");

		const boundary = fake.offsetOf("m-3") ?? 0;
		fake.grow("m-3", 400);
		anchor.absorbGrowth(boundary, 400);

		expect(fake.offsetOf("m-20")).toBe(before);
		expect(fake.scrollTop()).toBe(2400);
	});

	it("keeps the bottom pinned regardless of where the growth landed", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(fake.scrollHeight());

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		const boundary = fake.offsetOf("m-16") ?? 0;
		fake.grow("m-16", 250);
		anchor.absorbGrowth(boundary, 250);

		expect(anchor.isAtBottom()).toBe(true);
	});

	it("re-anchors after holding the lower side so the next growth is measured fresh", () => {
		const fake = createFakeSurface(makeRows("m", 40, 100), 600);
		fake.scrollTo(2000);

		const anchor = createScrollAnchor(fake.surface);
		anchor.capture();

		const firstBoundary = fake.offsetOf("m-21") ?? 0;
		fake.grow("m-21", 300);
		anchor.absorbGrowth(firstBoundary, 300);

		const before = fake.offsetOf("m-30");
		fake.grow("m-10", 200);
		anchor.restore();

		expect(fake.offsetOf("m-30")).toBe(before);
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
		const fake = createFakeSurface(makeRows("old", 20, 100), 600);
		fake.scrollTo(0);

		const anchor = createScrollAnchor(fake.surface);
		let loads = 0;
		let generation = 0;

		while (
			shouldLoadOlder({
				scrollTop: fake.scrollTop(),
				clientHeight: fake.clientHeight,
				hasMore: true,
				loading: false,
				ready: true,
			})
		) {
			loads += 1;
			if (loads > 5) break;
			anchor.capture();
			fake.prepend(makeRows(`page${generation++}`, 50, 100));
			anchor.restore();
		}

		expect(loads).toBe(1);
		expect(fake.scrollTop()).toBe(5000);
	});

	it("re-arms once the reader scrolls back up into the trigger zone", () => {
		const fake = createFakeSurface(makeRows("m", 100, 100), 600);
		fake.scrollTo(5000);

		const state = {
			clientHeight: fake.clientHeight,
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
		const fake = createFakeSurface(makeRows("old", 20, 100), 600);
		fake.scrollTo(0);

		const anchor = createScrollAnchor(fake.surface);
		let loads = 0;

		while (
			shouldLoadOlder({
				scrollTop: fake.scrollTop(),
				clientHeight: fake.clientHeight,
				hasMore: true,
				loading: false,
				ready: true,
			})
		) {
			loads += 1;
			if (loads > 20) break;
			anchor.capture();
			fake.prepend(makeRows(`page${loads}`, 2, 100));
			anchor.restore();
		}

		expect(loads).toBe(3);
		expect(fake.scrollTop()).toBe(600);
	});
});

describe("capture", () => {
	it("records bottom mode inside the threshold", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(1350);

		expect(captureAnchor(fake.surface).mode).toBe("bottom");
	});

	it("records row mode outside the threshold", () => {
		const fake = createFakeSurface(makeRows("m", 20, 100), 600);
		fake.scrollTo(1300);

		expect(captureAnchor(fake.surface).mode).toBe("row");
	});

	it("records no anchor for an empty list", () => {
		const fake = createFakeSurface([], 600);

		expect(captureAnchor(fake.surface).mode).toBe("bottom");
	});
});

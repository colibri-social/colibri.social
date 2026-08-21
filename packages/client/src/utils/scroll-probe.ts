import { createLogger, type LogEntry, logEntries } from "./logger";
import type { MessageScrollController, ScrollSurface } from "./message-scroll";

const log = createLogger("scroll");

const PROBE_KEY = "colibri:scroll-probe";
const started = Date.now();

const readFlag = (): boolean => {
	if (typeof localStorage === "undefined") return false;
	try {
		return localStorage.getItem(PROBE_KEY) === "1";
	} catch {
		return false;
	}
};

let enabled = import.meta.env.DEV || readFlag();

export const isScrollProbeEnabled = (): boolean => enabled;

export const setScrollProbeEnabled = (value: boolean): void => {
	enabled = value;
	if (typeof localStorage === "undefined") return;
	try {
		if (value) localStorage.setItem(PROBE_KEY, "1");
		else localStorage.removeItem(PROBE_KEY);
	} catch {}
};

export const probeScroll = (
	event: string,
	data?: Record<string, unknown>,
): void => {
	if (!enabled) return;
	log.info(event, { t: Date.now() - started, ...data });
};

const round = (value: number): number => Math.round(value * 10) / 10;

type Geometry = {
	top: number;
	scrollH: number;
	clientH: number;
	dist: number;
	pinned: boolean;
	gest: boolean;
	settling: boolean;
	anchor: string;
	rows: number;
};

const geometryOf = (
	surface: ScrollSurface,
	controller: MessageScrollController,
): Geometry => ({
	top: round(surface.getScrollTop()),
	scrollH: round(surface.getScrollHeight()),
	clientH: round(surface.getClientHeight()),
	dist: round(controller.distanceFromBottom()),
	pinned: controller.isPinned(),
	gest: controller.isGesturing(),
	settling: controller.isSettling(),
	anchor: controller.anchorMode(),
	rows: surface.rowCount(),
});

const shapeOf = (name: string, geometry: Geometry): string =>
	`${name}|${geometry.top}|${geometry.scrollH}|${geometry.clientH}|${geometry.pinned}|${geometry.gest}|${geometry.settling}|${geometry.anchor}|${geometry.rows}`;

const DEDUPED = new Set(["assert", "handleScroll", "settle", "absorbGrowth"]);

export const traceScrollController = (
	controller: MessageScrollController,
	surface: ScrollSurface,
): MessageScrollController => {
	if (!enabled) return controller;

	let lastShape = "";

	const wrap = <A extends Array<unknown>, R>(
		name: string,
		method: (...args: A) => R,
	) => {
		return (...args: A): R => {
			const before = geometryOf(surface, controller);
			const result = method(...args);
			const after = geometryOf(surface, controller);
			const shape = shapeOf(name, after);
			if (DEDUPED.has(name) && shape === lastShape) return result;
			lastShape = shape;
			probeScroll(name, {
				args: args.length > 0 ? JSON.stringify(args) : undefined,
				result: typeof result === "boolean" ? result : undefined,
				top: `${before.top}->${after.top}`,
				dist: `${before.dist}->${after.dist}`,
				scrollH: `${before.scrollH}->${after.scrollH}`,
				clientH: after.clientH,
				rows: after.rows,
				pinned: `${before.pinned}->${after.pinned}`,
				gest: after.gest,
				settling: after.settling,
				anchor: after.anchor,
			});
			return result;
		};
	};

	return {
		isPinned: () => controller.isPinned(),
		isGesturing: () => controller.isGesturing(),
		isSettling: () => controller.isSettling(),
		isAtBottom: () => controller.isAtBottom(),
		distanceFromBottom: () => controller.distanceFromBottom(),
		anchorMode: () => controller.anchorMode(),
		pin: wrap("pin", (options) => controller.pin(options)),
		unpin: wrap("unpin", () => controller.unpin()),
		reset: wrap("reset", () => controller.reset()),
		assert: wrap("assert", () => controller.assert()),
		settle: wrap("settle", (options) => controller.settle(options)),
		captureRowAnchor: wrap("captureRowAnchor", () =>
			controller.captureRowAnchor(),
		),
		absorbGrowth: wrap("absorbGrowth", (boundary: number, delta: number) =>
			controller.absorbGrowth(boundary, delta),
		),
		absorbPrepend: wrap("absorbPrepend", () => controller.absorbPrepend()),
		beginGesture: wrap("beginGesture", () => controller.beginGesture()),
		endGesture: wrap("endGesture", () => controller.endGesture()),
		cancelGesture: wrap("cancelGesture", () => controller.cancelGesture()),
		handleScroll: wrap("handleScroll", () => controller.handleScroll()),
		dispose: () => controller.dispose(),
	};
};

const WATCH_DURATION_MS = 4000;
const WATCH_INTERVAL_MS = 100;
const WATCH_EPSILON_PX = 1;

export const watchBottomDrift = (
	label: string,
	surface: ScrollSurface,
	controller: MessageScrollController,
): (() => void) => {
	if (!enabled) return () => {};

	const startedAt = Date.now();
	let lastDist = Number.NaN;
	let lastRows = -1;

	probeScroll(`${label}: watch start`, geometryOf(surface, controller));

	const timer = setInterval(() => {
		const geometry = geometryOf(surface, controller);
		const elapsed = Date.now() - startedAt;
		const moved =
			Number.isNaN(lastDist) ||
			Math.abs(geometry.dist - lastDist) >= WATCH_EPSILON_PX ||
			geometry.rows !== lastRows;

		if (moved) {
			lastDist = geometry.dist;
			lastRows = geometry.rows;
			probeScroll(`${label}: drift`, { atMs: elapsed, ...geometry });
		}

		if (elapsed < WATCH_DURATION_MS) return;
		clearInterval(timer);
		probeScroll(`${label}: watch end`, geometryOf(surface, controller));
	}, WATCH_INTERVAL_MS);

	return () => clearInterval(timer);
};

const SCOPES = new Set(["scroll", "switch"]);

const dumpEntries = (): Array<LogEntry> =>
	logEntries().filter((entry) => SCOPES.has(entry.scope));

const formatDump = (): string =>
	dumpEntries()
		.map((entry) => {
			const time = new Date(entry.atMs).toISOString().slice(11, 23);
			const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
			return `${time} [${entry.scope}] ${entry.message}${data}`;
		})
		.join("\n");

interface ScrollProbeApi {
	on: () => void;
	off: () => void;
	dump: () => string;
	entries: () => Array<LogEntry>;
}

declare global {
	interface Window {
		__colibriScroll?: ScrollProbeApi;
	}
}

if (typeof window !== "undefined") {
	window.__colibriScroll = {
		on: () => setScrollProbeEnabled(true),
		off: () => setScrollProbeEnabled(false),
		dump: () => {
			const text = formatDump();
			console.info(text);
			return text;
		},
		entries: dumpEntries,
	};
}

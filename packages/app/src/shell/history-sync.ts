import { historyBusy, historyGo, whenHistoryIdle } from "./history-go";
import { parsePath, pathAt, type Root, type Route } from "./layers";

export type HistoryPort = {
	state: () => unknown;
	path: () => string;
	push: (state: unknown, url: string) => void;
	replace: (state: unknown, url: string) => void;
	go: (delta: number) => void;
	onPop: (listener: () => void) => () => void;
	whenActivated?: (run: () => void) => void;
	busy?: () => boolean;
	whenIdle?: (run: () => void) => void;
};

const DEPTH_KEY = "colibriDepth";

export const depthOf = (state: unknown) => {
	const value = (state as Record<string, unknown> | null)?.[DEPTH_KEY];
	return typeof value === "number" ? value : 0;
};

const TAB_OVER_KEY = "colibriTabOver";

const isTabOver = (state: unknown) =>
	(state as Record<string, unknown> | null)?.[TAB_OVER_KEY] === true;

const entry = (depth: number, tabOver = false) =>
	tabOver
		? { [DEPTH_KEY]: depth, [TAB_OVER_KEY]: true }
		: { [DEPTH_KEY]: depth };

const OVERLAY_KEY = "colibriOverlay";

const hasOverlay = (state: unknown) =>
	typeof (state as Record<string, unknown> | null)?.[OVERLAY_KEY] === "number";

export const browserHistory = (): HistoryPort => ({
	state: () => window.history.state,
	path: () => window.location.pathname,
	push: (state, url) => window.history.pushState(state, "", url),
	replace: (state, url) => window.history.replaceState(state, "", url),
	go: (delta) => historyGo(delta),
	busy: historyBusy,
	whenIdle: whenHistoryIdle,
	onPop: (listener) => {
		window.addEventListener("popstate", listener);
		return () => window.removeEventListener("popstate", listener);
	},
	whenActivated: (run) => {
		if (navigator.userActivation?.hasBeenActive !== false) {
			run();
			return;
		}
		const events = ["pointerdown", "keydown"] as const;
		const once = () => {
			for (const name of events) {
				window.removeEventListener(name, once, true);
			}
			run();
		};
		for (const name of events) window.addEventListener(name, once, true);
	},
});

export type ExternalNavigation = {
	route: Route;
	depth: number;
	path: string;
};

export const createHistorySync = (options: {
	port: HistoryPort;
	route: () => Route;
	onExternal: (navigation: ExternalNavigation) => void;
	parse?: (path: string) => Route;
	stacksOverTab?: (root: Root) => boolean;
}) => {
	const { port } = options;
	const parse = options.parse ?? parsePath;
	const stacksOverTab = options.stacksOverTab ?? (() => false);
	let pendingPop = false;
	let dirty = false;
	let disposed = false;
	let basePath: string | undefined;

	const writeStack = (route: Route) => {
		basePath = pathAt(route, 0);
		port.replace(entry(0), basePath);
		for (let depth = 1; depth <= route.layers.length; depth++) {
			port.push(entry(depth), pathAt(route, depth));
		}
	};

	let pendingSeed: Route | undefined;

	const flushSeed = () => {
		const route = pendingSeed;
		if (!route || disposed) return;
		pendingSeed = undefined;
		if (depthOf(port.state()) !== route.layers.length) return;
		writeStack(route);
	};

	const seed = (route: Route) => {
		const depth = route.layers.length;
		if (depth === 0 || !port.whenActivated) {
			writeStack(route);
			return;
		}
		basePath = pathAt(route, 0);
		port.replace(entry(depth), pathAt(route, depth));
		pendingSeed = route;
		port.whenActivated(flushSeed);
	};

	let waitingForIdle = false;

	const sync = () => {
		if (disposed) return;
		flushSeed();
		if (!pendingPop && port.busy?.() && port.whenIdle) {
			if (!waitingForIdle) {
				waitingForIdle = true;
				port.whenIdle(() => {
					waitingForIdle = false;
					sync();
				});
			}
			return;
		}
		if (pendingPop) {
			dirty = true;
			return;
		}
		const route = options.route();
		const desired = route.layers.length;
		const current = depthOf(port.state());
		const onTabOver = current === 0 && isTabOver(port.state());
		const wantsTabOver = stacksOverTab(route.root);
		if (onTabOver && !wantsTabOver) {
			pendingPop = true;
			port.go(-1);
			return;
		}
		if (
			current === 0 &&
			!onTabOver &&
			wantsTabOver &&
			!hasOverlay(port.state()) &&
			port.path() !== pathAt(route, 0)
		) {
			basePath = pathAt(route, 0);
			port.push(entry(0, true), basePath);
		}
		const rootChanged =
			current > 0 && basePath !== undefined && basePath !== pathAt(route, 0);
		if (desired < current || rootChanged) {
			pendingPop = true;
			port.go((rootChanged ? 0 : desired) - current);
			return;
		}
		const currentPath = pathAt(route, current);
		const overlayOnTop = desired > current && hasOverlay(port.state());
		if (!overlayOnTop && port.path() !== currentPath) {
			port.replace(entry(current, onTabOver), currentPath);
		}
		if (current === 0) basePath = currentPath;
		for (let depth = current + 1; depth <= desired; depth++) {
			if (overlayOnTop && depth === current + 1) {
				port.replace(entry(depth), pathAt(route, depth));
			} else {
				port.push(entry(depth), pathAt(route, depth));
			}
		}
	};

	const stopListening = port.onPop(() => {
		if (pendingPop) {
			pendingPop = false;
			dirty = false;
			if (depthOf(port.state()) === 0) basePath = port.path();
			sync();
			return;
		}
		const depth = depthOf(port.state());
		const parsed = parse(port.path());
		if (depth === 0) basePath = port.path();
		options.onExternal({
			route: { root: parsed.root, layers: parsed.layers.slice(0, depth) },
			depth,
			path: port.path(),
		});
	});

	const dispose = () => {
		disposed = true;
		pendingSeed = undefined;
		stopListening();
	};

	return {
		seed,
		sync,
		dispose,
		isPending: () => pendingPop || dirty,
	};
};

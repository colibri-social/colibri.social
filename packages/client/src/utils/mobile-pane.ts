import {
	useIsRouting,
	useLocation,
	useNavigate,
	useSearchParams,
} from "@solidjs/router";
import { batch, createEffect, createSignal } from "solid-js";
import createMediaQuery from "./create-media-query";

const CHANNEL_PATH = /^\/app\/c\/[^/]+\/[^/]+\/[^/]+/;
const COMMUNITY_SEGMENT = /^\/app\/c\/([^/]+)/;

const lastViewedChannelPath = (pathname: string): string | undefined => {
	const segment = COMMUNITY_SEGMENT.exec(pathname)?.[1];
	if (!segment) return undefined;
	const raw = localStorage.getItem(`${segment}:last-viewed`);
	if (!raw) return undefined;
	try {
		const channel = JSON.parse(raw) as { uri: string; type: string };
		const identifier = channel.uri.split("/").pop();
		if (!identifier) return undefined;
		return `/app/c/${segment}/${channel.type}/${identifier}`;
	} catch {
		return undefined;
	}
};

export type Pane = "nav" | "chat" | "members";

export const MOBILE_QUERY = "(max-width: 767px)";

export const useIsMobile = () => createMediaQuery(MOBILE_QUERY);

export const isMobileNow = () =>
	typeof matchMedia !== "undefined" && matchMedia(MOBILE_QUERY).matches;

const [dragDx, setDragDx] = createSignal(0);
// Deliberately not derived from `dragDx() !== 0`: a drag that momentarily
// returns to its origin would otherwise re-enable the settle transition
// halfway through the gesture.
const [dragging, setDragging] = createSignal(false);
// Optimistic pane. `navigate()` commits through the router's `startTransition`,
// so the URL can lag a pane change by a whole suspense round trip. Without this
// the panes would fall back to their previous resting offsets the instant the
// drag is released and only slide to the new ones once the route lands.
const [pendingPane, setPendingPane] = createSignal<Pane | null>(null);

const paneIndex = (pane: Pane) =>
	pane === "nav" ? -1 : pane === "chat" ? 0 : 1;

const RAIL_WIDTH = 56;
const RUBBER_BAND = 0.15;

/** Fraction of the pane width a drag has to cover before it switches panes. */
export const PANE_COMMIT_RATIO = 0.45;

const viewportWidth = () =>
	typeof window !== "undefined" ? window.innerWidth : 0;

const navRevealProgress = (current: Pane) => {
	const width = viewportWidth();
	if (!width) return 1;
	const offset = (paneIndex("nav") - paneIndex(current)) * width + dragDx();
	return Math.max(0, Math.min(1, 1 + offset / width));
};

/**
 * Mobile navigation stack. The desktop layout shows every pane at once, on
 * mobile only one is visible at a time and the visible pane is derived from
 * the URL so the browser/Android back & forward buttons traverse the stack
 */
export const createMobilePane = () => {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();
	const isRouting = useIsRouting();
	const isMobile = createMediaQuery(MOBILE_QUERY);

	const hasChannel = () => CHANNEL_PATH.test(location.pathname);

	const paneFromUrl = (): Pane => {
		if (searchParams.pane === "nav") return "nav";
		if (searchParams.pane === "members" && hasChannel()) return "members";
		return hasChannel() ? "chat" : "nav";
	};

	const currentPane = (): Pane => pendingPane() ?? paneFromUrl();

	// Once the router has settled the URL is authoritative again. Keying off
	// `isRouting()` rather than "the URL agrees" is what makes this impossible to
	// get stuck on: navigating to the URL we are already on is a no-op that never
	// fires a location change, `useBeforeLeave` can veto, and a back press
	// mid-animation can land on a third pane entirely.
	// Reading `pendingPane()` here is deliberate: it subscribes the effect to its
	// own signal, so a `navigate()` that turns out to be a no-op still re-runs
	// this and clears the optimistic value. Without that read the effect would
	// only wake on a URL or routing change — neither of which happens — and the
	// pane would stay stuck on a target it already reached.
	createEffect(() => {
		if (isRouting()) return;
		paneFromUrl();
		if (pendingPane() !== null) setPendingPane(null);
	});

	const canPop = (from: Pane) => from !== "nav";

	const canPush = (from: Pane) =>
		from === "chat" ||
		(from === "nav" &&
			(hasChannel() || !!lastViewedChannelPath(location.pathname)));

	// The optimistic write and the navigation have to land in one batch, or the
	// effect above runs in between — `pendingPane` set, `isRouting()` still
	// false — and clears it immediately.
	const commit = (pane: Pane, url: string, replace?: boolean) =>
		batch(() => {
			setPendingPane(pane);
			navigate(url, { replace });
		});

	const setPane = (target: Pane, opts?: { replace?: boolean }) => {
		const search = target === "chat" ? "" : `?pane=${target}`;
		commit(target, `${location.pathname}${search}`, opts?.replace);
	};

	const pushPane = (target: Pane) => setPane(target);

	const dismissKeyboard = () => {
		if (!isMobile()) return;
		(document.activeElement as HTMLElement | null)?.blur();
	};

	const popPane = () => {
		const from = currentPane();
		if (!canPop(from)) return;
		if (from === "chat") dismissKeyboard();
		setPane(from === "members" ? "chat" : "nav");
	};

	const pushDeeper = () => {
		const from = currentPane();
		if (!canPush(from)) return;
		if (from === "chat") {
			dismissKeyboard();
			return setPane("members");
		}
		if (hasChannel()) return setPane("chat");
		const target = lastViewedChannelPath(location.pathname);
		// A pathname change rather than a pane change, but it moves the carousel
		// all the same, so it needs the same optimism as `setPane()`.
		if (target) commit("chat", target);
	};

	// Snapshotted once per gesture so the rubber banding and the release commit
	// can never disagree about whether the move is possible.
	let canPushDeeper: boolean | null = null;

	const updateDrag = (dx: number | null) => {
		if (dx === null) {
			canPushDeeper = null;
			// One batch, one style recalculation: the transition classes come back
			// and the new resting offset is applied together, so the transition
			// starts from the position that is currently painted instead of
			// teleporting to the old pane's resting offset first.
			batch(() => {
				setDragging(false);
				setDragDx(0);
			});
			return;
		}

		const from = currentPane();
		if (canPushDeeper === null) canPushDeeper = canPush(from);
		if (dx > 0 && !canPop(from)) dx *= RUBBER_BAND;
		if (dx < 0 && !canPushDeeper) dx *= RUBBER_BAND;
		const max = viewportWidth() || Infinity;
		batch(() => {
			setDragging(true);
			setDragDx(Math.max(-max, Math.min(max, dx)));
		});
	};

	// Single source of truth for mobile pane position: the carousel slot's
	// resting offset plus the live drag. `100%` is the pane's own border box,
	// which is exactly the viewport width for all three panes (they are
	// `absolute inset-0 w-full` inside a full-bleed container), so mixing it
	// with a pixel drag is safe, and percentages reflow for free on rotation.
	const paneTranslate = (pane: Pane): string | undefined => {
		if (!isMobile()) return undefined;
		const offset = (paneIndex(pane) - paneIndex(currentPane())) * 100;
		return `calc(${offset}% + ${dragDx()}px)`;
	};

	const railTranslate = (): string | undefined => {
		if (!isMobile()) return undefined;
		const hidden = 1 - navRevealProgress(currentPane());
		return `${-RAIL_WIDTH * hidden}px`;
	};

	const isDragging = dragging;

	return {
		isMobile,
		currentPane,
		hasChannel,
		pushPane,
		popPane,
		pushDeeper,
		setPane,
		updateDrag,
		paneTranslate,
		railTranslate,
		isDragging,
	};
};

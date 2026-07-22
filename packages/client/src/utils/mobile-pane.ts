import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal } from "solid-js";
import createMediaQuery from "./create-media-query";

const CHANNEL_PATH = /^\/app\/c\/[^/]+\/[^/]+\/[^/]+/;

export type Pane = "nav" | "chat" | "members";

export const MOBILE_QUERY = "(max-width: 767px)";

export const useIsMobile = () => createMediaQuery(MOBILE_QUERY);

export const isMobileNow = () =>
	typeof matchMedia !== "undefined" && matchMedia(MOBILE_QUERY).matches;

const [dragDx, setDragDx] = createSignal(0);

const paneIndex = (pane: Pane) =>
	pane === "nav" ? -1 : pane === "chat" ? 0 : 1;

/**
 * Mobile navigation stack. The desktop layout shows every pane at once, on
 * mobile only one is visible at a time and the visible pane is derived from
 * the URL so the browser/Android back & forward buttons traverse the stack
 */
export const createMobilePane = () => {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();
	const isMobile = createMediaQuery(MOBILE_QUERY);

	const hasChannel = () => CHANNEL_PATH.test(location.pathname);

	const currentPane = (): Pane => {
		if (searchParams.pane === "nav") return "nav";
		if (searchParams.pane === "members" && hasChannel()) return "members";
		return hasChannel() ? "chat" : "nav";
	};

	const setPane = (target: Pane, opts?: { replace?: boolean }) => {
		const search = target === "chat" ? "" : `?pane=${target}`;
		navigate(`${location.pathname}${search}`, { replace: opts?.replace });
	};

	const pushPane = (target: Pane) => setPane(target);

	const popPane = () => {
		const from = currentPane();
		if (from === "members") return setPane("chat");
		if (from === "chat") return setPane("nav");
		// already at nav root
	};

	const pushDeeper = () => {
		const from = currentPane();
		if (from === "nav" && hasChannel()) return setPane("chat");
		if (from === "chat") return setPane("members");
		// members is the deepest pane
	};

	const updateDrag = (dx: number | null) => {
		if (dx === null) {
			setDragDx(0);
			return;
		}
		const from = currentPane();
		if (dx > 0 && from === "nav") dx = 0; // popPane() would no-op here
		if (dx < 0 && from === "members") dx = 0; // pushDeeper() would no-op here
		const max = typeof window !== "undefined" ? window.innerWidth : Infinity;
		setDragDx(Math.max(-max, Math.min(max, dx)));
	};

	const paneTransform = (pane: Pane): string | undefined => {
		if (!isMobile() || dragDx() === 0) return undefined;
		const offset = (paneIndex(pane) - paneIndex(currentPane())) * 100;
		return `translateX(calc(${offset}% + ${dragDx()}px))`;
	};

	const isDragging = () => dragDx() !== 0;

	return {
		isMobile,
		currentPane,
		hasChannel,
		pushPane,
		popPane,
		pushDeeper,
		setPane,
		updateDrag,
		paneTransform,
		isDragging,
	};
};

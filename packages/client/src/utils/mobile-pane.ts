import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal } from "solid-js";
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

const paneIndex = (pane: Pane) =>
	pane === "nav" ? -1 : pane === "chat" ? 0 : 1;

const RAIL_WIDTH = 56;

const navRevealProgress = (current: Pane) => {
	const width = typeof window !== "undefined" ? window.innerWidth : 0;
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

	const dismissKeyboard = () => {
		if (!isMobile()) return;
		(document.activeElement as HTMLElement | null)?.blur();
	};

	const popPane = () => {
		const from = currentPane();
		if (from === "members") return setPane("chat");
		if (from === "chat") {
			dismissKeyboard();
			return setPane("nav");
		}
		// already at nav root
	};

	const pushDeeper = () => {
		const from = currentPane();
		if (from === "nav") {
			if (hasChannel()) return setPane("chat");
			const target = lastViewedChannelPath(location.pathname);
			if (target) return navigate(target);
			return;
		}
		if (from === "chat") {
			dismissKeyboard();
			return setPane("members");
		}
		// members is the deepest pane
	};

	let canPushDeeper: boolean | null = null;

	const updateDrag = (dx: number | null) => {
		if (dx === null) {
			canPushDeeper = null;
			setDragDx(0);
			return;
		}
		const from = currentPane();
		if (canPushDeeper === null) {
			canPushDeeper =
				from === "chat" ||
				(from === "nav" &&
					(hasChannel() || !!lastViewedChannelPath(location.pathname)));
		}
		if (dx > 0 && from === "nav") dx *= 0.15; // popPane() would no-op here
		if (dx < 0 && !canPushDeeper) dx *= 0.15; // pushDeeper() would no-op here
		const max = typeof window !== "undefined" ? window.innerWidth : Infinity;
		setDragDx(Math.max(-max, Math.min(max, dx)));
	};

	const paneTranslate = (pane: Pane): string | undefined => {
		if (!isMobile() || dragDx() === 0) return undefined;
		const offset = (paneIndex(pane) - paneIndex(currentPane())) * 100;
		return `calc(${offset}% + ${dragDx()}px)`;
	};

	const railTranslate = (): string | undefined => {
		if (!isMobile() || dragDx() === 0) return undefined;
		const hidden = 1 - navRevealProgress(currentPane());
		return `${-RAIL_WIDTH * hidden}px`;
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
		paneTranslate,
		railTranslate,
		isDragging,
	};
};

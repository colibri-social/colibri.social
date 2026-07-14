import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { isTauriRuntime } from "../notifications/environment";
import createMediaQuery from "./create-media-query";

const CHANNEL_PATH = /^\/app\/c\/[^/]+\/[^/]+\/[^/]+/;

export type Pane = "nav" | "chat" | "members";

export const MOBILE_QUERY = "(max-width: 767px)";

export const useIsMobile = () => createMediaQuery(MOBILE_QUERY);

export const isMobileNow = () =>
	typeof matchMedia !== "undefined" && matchMedia(MOBILE_QUERY).matches;

/**
 * False for the native app at a non-mobile viewport width (iPad)
 */
export const canAutofocusComposer = () => !isTauriRuntime() || isMobileNow();

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

	return {
		isMobile,
		currentPane,
		hasChannel,
		pushPane,
		popPane,
		pushDeeper,
		setPane,
	};
};

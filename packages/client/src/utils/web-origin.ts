import { isTauriRuntime } from "../notifications/environment";

const PUBLIC_WEB_ORIGIN = "https://colibri.social";

export const webAppOrigin = (): string => {
	if (typeof window === "undefined") return PUBLIC_WEB_ORIGIN;

	const configured = (window as { __COLIBRI_WEB_ORIGIN__?: string })
		.__COLIBRI_WEB_ORIGIN__;
	if (configured) return configured;

	if (isTauriRuntime()) return PUBLIC_WEB_ORIGIN;

	return window.location.origin;
};

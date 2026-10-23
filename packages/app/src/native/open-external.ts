import { openAppLink } from "./deep-links";

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const NATIVE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const parse = (href: string): URL | undefined => {
	try {
		return new URL(href, location.href);
	} catch {
		return undefined;
	}
};

export const isExternalHref = (href: string | null | undefined): boolean => {
	if (!href) return false;
	const url = parse(href);
	if (!url) return false;
	const protocols = isTauri() ? NATIVE_PROTOCOLS : WEB_PROTOCOLS;
	if (!protocols.has(url.protocol)) return false;
	return url.origin !== location.origin;
};

export const openExternalUrl = (url: string): void => {
	if (!isTauri()) {
		window.open(url, "_blank", "noopener,noreferrer");
		return;
	}
	void import("@tauri-apps/api/core")
		.then(({ invoke }) => invoke("open_external_url", { url }))
		.catch(() => undefined);
};

export const externalAnchorOf = (
	event: Event,
): HTMLAnchorElement | undefined => {
	const target = event.target;
	if (!(target instanceof Element)) return undefined;
	const anchor = target.closest("a[href]");
	if (!(anchor instanceof HTMLAnchorElement)) return undefined;
	return isExternalHref(anchor.href) ? anchor : undefined;
};

const hasModifier = (event: MouseEvent) =>
	event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

const anchorOf = (event: Event): HTMLAnchorElement | undefined => {
	const target = event.target;
	if (!(target instanceof Element)) return undefined;
	const anchor = target.closest("a[href]");
	return anchor instanceof HTMLAnchorElement ? anchor : undefined;
};

const openedInApp = (event: MouseEvent, anchor: HTMLAnchorElement) => {
	if (event.type !== "click" || anchor.hasAttribute("download")) return false;
	if (!isTauri() && hasModifier(event)) return false;
	if (!openAppLink(anchor.href)) return false;
	event.preventDefault();
	return true;
};

const handleClick = (event: MouseEvent) => {
	if (event.defaultPrevented) return;
	if (event.type === "auxclick" && event.button !== 1) return;
	if (event.type === "click" && event.button !== 0) return;
	const target = anchorOf(event);
	if (target && openedInApp(event, target)) return;
	const anchor = externalAnchorOf(event);
	if (!anchor) return;
	if (!isTauri()) {
		if (anchor.hasAttribute("download")) return;
		if (event.type === "auxclick" || hasModifier(event)) return;
		if (anchor.target === "_blank") return;
	}
	event.preventDefault();
	openExternalUrl(anchor.href);
};

export const installExternalLinkInterceptor = (): (() => void) => {
	window.addEventListener("click", handleClick);
	window.addEventListener("auxclick", handleClick);
	return () => {
		window.removeEventListener("click", handleClick);
		window.removeEventListener("auxclick", handleClick);
	};
};

import { createSignal } from "solid-js";
import { isBskyHost } from "../atproto/bsky-post-url";
import { isTauriRuntime } from "../notifications/environment";
import { isSafeLinkUri } from "./link-safety";
import { openExternalLink } from "./open-external-link";
import { webAppOrigin } from "./web-origin";

const COLIBRI_HOSTS = new Set(["colibri.social", "next.colibri.social"]);

const [pending, setPending] = createSignal<string | null>(null);
const [warningEnabled, setWarningEnabled] = createSignal(true);

export const pendingExternalLink = pending;

export const setExternalLinkWarningEnabled = setWarningEnabled;

const hostOf = (url: string): string | null => {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
};

const isTrustedHost = (host: string): boolean => {
	if (COLIBRI_HOSTS.has(host) || isBskyHost(host)) return true;
	return host === hostOf(webAppOrigin());
};

const navigate = (url: string): void => {
	if (isTauriRuntime()) {
		openExternalLink(url);
		return;
	}
	window.open(url, "_blank", "noopener,noreferrer");
};

export const openUntrustedLink = (
	url: string | undefined,
	event?: { preventDefault: () => void },
): void => {
	const host = url && isSafeLinkUri(url) ? hostOf(url) : null;
	if (!url || !host) {
		event?.preventDefault();
		return;
	}

	if (!warningEnabled() || isTrustedHost(host)) {
		openExternalLink(url, event);
		return;
	}

	event?.preventDefault();
	setPending(url);
};

export const dismissPendingExternalLink = (): void => {
	setPending(null);
};

export const resolvePendingExternalLink = (): void => {
	const url = pending();
	setPending(null);
	if (url) navigate(url);
};

export const handleExternalLinkClick = (event: MouseEvent): void => {
	const anchor = (event.target as HTMLElement | null)?.closest?.("a");
	if (anchor?.href) openUntrustedLink(anchor.href, event);
};

export const DEFAULT_APPVIEW_URL = "https://spaces-api.colibri.social";

export const DEV_APPVIEW_HOST = "127.0.0.1:3000";

export const APPVIEW_FRAGMENT = "colibri_appview";

export const NOTIF_FRAGMENT = "colibri_notifs";

const RETIRED_APPVIEW_HOSTS = new Set(["api.colibri.social"]);

export const normalizeAppViewUrl = (raw: string): string | null => {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	try {
		const url = new URL(
			trimmed.includes("://") ? trimmed : `https://${trimmed}`,
		);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.origin;
	} catch {
		return null;
	}
};

export const isValidAppViewUrl = (raw: string): boolean =>
	normalizeAppViewUrl(raw) !== null;

export const resolveStoredAppViewUrl = (stored: unknown): string => {
	const normalized =
		typeof stored === "string" ? normalizeAppViewUrl(stored) : null;
	if (!normalized) return DEFAULT_APPVIEW_URL;
	return RETIRED_APPVIEW_HOSTS.has(new URL(normalized).host)
		? DEFAULT_APPVIEW_URL
		: normalized;
};

export const didWebForHost = (host: string): string =>
	`did:web:${host.replace(/^(127\.0\.0\.1|\[::1\])(?=$|:)/, "localhost").replace(/:/g, "%3A")}`;

export const serviceRefFor = (did: string, fragment: string): string =>
	`${did}#${fragment}`;

export const appViewServiceRef = (did: string): string =>
	serviceRefFor(did, APPVIEW_FRAGMENT);

export const notifServiceRef = (did: string): string =>
	serviceRefFor(did, NOTIF_FRAGMENT);

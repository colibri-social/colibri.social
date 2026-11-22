import {
	APPVIEW_FRAGMENT,
	DEFAULT_APPVIEW_URL,
	didWebForHost,
	normalizeAppViewUrl,
	serviceRefFor,
} from "@colibri-social/lib";

const configuredUrl = (): string | undefined => {
	const raw: unknown = import.meta.env.VITE_COLIBRI_APPVIEW_URL;
	return typeof raw === "string"
		? (normalizeAppViewUrl(raw) ?? undefined)
		: undefined;
};

export const appViewUrl = (): string => configuredUrl() ?? DEFAULT_APPVIEW_URL;

export const isDefaultAppView = (url: string = appViewUrl()): boolean =>
	new URL(url).host === new URL(DEFAULT_APPVIEW_URL).host;

export const appViewDid = (url: string = appViewUrl()): string =>
	didWebForHost(new URL(url).host);

export const appViewServiceRef = (url: string = appViewUrl()): string =>
	serviceRefFor(appViewDid(url), APPVIEW_FRAGMENT);

export const appViewHost = (
	protocol: "ws" | "http",
	url: string = appViewUrl(),
): string => {
	const parsed = new URL(url);
	const secure = parsed.protocol === "https:";
	const scheme =
		protocol === "ws" ? (secure ? "wss" : "ws") : secure ? "https" : "http";
	return `${scheme}://${parsed.host}`;
};

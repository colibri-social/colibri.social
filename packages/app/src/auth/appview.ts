import {
	APPVIEW_FRAGMENT,
	DEFAULT_APPVIEW_URL,
	didWebForHost,
	normalizeAppViewUrl,
	serviceRefFor,
} from "@colibri-social/lib";
import { DEVICE_KEYS } from "../data/device-prefs";
import { readStored, writeStored } from "../data/persist";

const configuredUrl = (): string | undefined => {
	const raw: unknown = import.meta.env.VITE_COLIBRI_APPVIEW_URL;
	return typeof raw === "string"
		? (normalizeAppViewUrl(raw) ?? undefined)
		: undefined;
};

const chosenUrl = (): string | undefined => {
	const stored = readStored(DEVICE_KEYS.appView);

	return stored ? (normalizeAppViewUrl(stored) ?? undefined) : undefined;
};

export const appViewUrl = (): string =>
	chosenUrl() ?? configuredUrl() ?? DEFAULT_APPVIEW_URL;

export const builtInAppViewUrl = (): string =>
	configuredUrl() ?? DEFAULT_APPVIEW_URL;

export const chooseAppView = (url: string | undefined) => {
	const builtIn = new URL(builtInAppViewUrl()).host;
	const keep = url && new URL(url).host !== builtIn ? url : undefined;

	writeStored(DEVICE_KEYS.appView, keep);
};

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

export const restartWithAppView = (url: string | undefined) => {
	chooseAppView(url);
	location.reload();
};

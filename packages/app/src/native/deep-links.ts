import { DEVICE_KEYS } from "../data/device-prefs";
import { readStoredJSON, writeStoredJSON } from "../data/persist";
import { parsePath, type Route } from "../shell/layers";

export const PENDING_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const APP_HOSTS = new Set([
	"colibri.social",
	"next.colibri.social",
	"spaces.colibri.social",
]);

type PendingLink = { path: string; at: number };

const isPendingLink = (value: unknown): value is PendingLink =>
	!!value &&
	typeof value === "object" &&
	typeof (value as PendingLink).path === "string" &&
	typeof (value as PendingLink).at === "number";

const decode = (part: string) => {
	try {
		return decodeURIComponent(part);
	} catch {
		return undefined;
	}
};

const segment = (part: string | undefined) => {
	const decoded = part === undefined ? undefined : decode(part);
	return decoded ? encodeURIComponent(decoded) : undefined;
};

const schemePath = (url: URL) => {
	const [head, ...rest] = [url.host, ...url.pathname.split("/")].filter(
		Boolean,
	);
	if (head === "invite") {
		const code = segment(rest[0]);
		return code && rest.length === 1 ? `/app/invite/${code}` : undefined;
	}
	if (head === "channel") {
		const community = rest[0] ? decode(rest[0]) : undefined;
		const channelType = segment(rest[1]);
		const channel = segment(rest[2]);
		if (!community?.startsWith("did:") || !channelType || !channel)
			return undefined;
		return `/app/c/${community}/${channelType}/${channel}`;
	}
	return undefined;
};

const webPath = (url: URL) => {
	if (!APP_HOSTS.has(url.hostname)) return undefined;
	if (url.pathname.startsWith("/invite/")) return `/app${url.pathname}`;
	if (url.pathname.startsWith("/app/")) return url.pathname;
	return undefined;
};

export const appPathFromLink = (link: string): string | undefined => {
	let url: URL;
	try {
		url = new URL(link.trim());
	} catch {
		return undefined;
	}
	if (url.protocol.startsWith("social.colibri")) return schemePath(url);
	if (url.protocol === "https:" || url.protocol === "http:")
		return webPath(url);
	return undefined;
};

export const routeFromLink = (link: string): Route | undefined => {
	const path = appPathFromLink(link);
	if (!path) return undefined;
	const route = parsePath(path);
	return route.layers.some((layer) => layer.kind === "notFound")
		? undefined
		: route;
};

const handlers = new Set<(route: Route) => void>();

export const openAppLink = (
	link: string,
	now: () => number = Date.now,
): boolean => {
	const route = routeFromLink(link);
	if (!route) return false;
	const path = appPathFromLink(link) as string;
	if (handlers.size === 0) {
		writeStoredJSON(DEVICE_KEYS.pendingLink, { path, at: now() });
		return true;
	}
	for (const handler of [...handlers]) handler(route);
	return true;
};

export const takePendingLink = (
	now: () => number = Date.now,
): Route | undefined => {
	const pending = readStoredJSON(DEVICE_KEYS.pendingLink, isPendingLink);
	if (!pending) return undefined;
	writeStoredJSON(DEVICE_KEYS.pendingLink, undefined);
	if (now() - pending.at > PENDING_LINK_TTL_MS) return undefined;
	const route = parsePath(pending.path);
	return route.layers.some((layer) => layer.kind === "notFound")
		? undefined
		: route;
};

export const listenForAppLinks = (
	handler: (route: Route) => void,
	now: () => number = Date.now,
) => {
	handlers.add(handler);
	const pending = takePendingLink(now);
	if (pending) handler(pending);
	return () => {
		handlers.delete(handler);
	};
};

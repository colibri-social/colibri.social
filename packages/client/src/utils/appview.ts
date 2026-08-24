const STORAGE_KEY = "colibri:user-preferences";

/**
 * The AppView every install talks to until the user points themselves at a
 * different one. Defined here (rather than imported from the preferences
 * context) so low-level modules like `auth.ts` can resolve it from module scope
 * without pulling in Solid. Keep in sync with the default DID in
 * `atproto/scopes.ts`.
 */
export const DEFAULT_APPVIEW_URL = "https://spaces-api.colibri.social";

export const DEV_APPVIEW_HOST = "127.0.0.1:3000";

export const getAppViewHost = (protocol: "ws" | "http") => {
	if (import.meta.env.DEV) return `${protocol}://${DEV_APPVIEW_HOST}`;
	const { host } = new URL(getPreferredAppViewUrl());
	return `${protocol === "ws" ? "wss" : "https"}://${host}`;
};

/**
 * Reads the user's chosen AppView origin from localStorage, falling back to
 * {@link DEFAULT_APPVIEW_URL}. Synchronous and side-effect free so it can be
 * called during auth bootstrap, before any context is mounted.
 */
export const getPreferredAppViewUrl = (): string => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_APPVIEW_URL;
		const stored = (JSON.parse(raw) as { preferredAppView?: string })
			.preferredAppView;
		return resolveStoredAppViewUrl(stored);
	} catch {
		return DEFAULT_APPVIEW_URL;
	}
};

const RETIRED_APPVIEW_HOSTS = new Set(["api.colibri.social"]);

/**
 * Turns whatever is in storage into a usable AppView origin. A host that no
 * longer serves this client falls back to {@link DEFAULT_APPVIEW_URL}, so an
 * install that saved the old default isn't stranded on it.
 */
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

/**
 * The `did:web` identifier for an AppView, derived from its host. This is the
 * DID our service-auth `aud`s and OAuth permission-set scopes pin to, so it
 * must match the DID the AppView publishes in its DID document. Defaults to the
 * user's chosen AppView.
 */
export const getAppViewDid = (url: string = getPreferredAppViewUrl()): string =>
	didWebForHost(new URL(url).host);

/**
 * The host URL for an AppView addressed by its `did:web` DID — the inverse of
 * {@link getAppViewDid}. Used to dial an AppView the user hasn't configured as
 * their preferred one (e.g. a community's hub AppView for voice signaling).
 * Strips the `did:web:` prefix and decodes the `%3A` port separator. Mirrors
 * {@link getAppViewHost}'s DEV special-case so local development still targets
 * the dev AppView. Returns `null` when the DID isn't a usable `did:web`.
 */
export const getAppViewHostFromDid = (
	did: string,
	protocol: "ws" | "http",
): string | null => {
	if (import.meta.env.DEV) return `${protocol}://${DEV_APPVIEW_HOST}`;
	if (!did.startsWith("did:web:")) return null;
	const host = decodeURIComponent(did.slice("did:web:".length));
	if (!host) return null;
	return `${protocol === "ws" ? "wss" : "https"}://${host}`;
};

export const appViewHostFor = (
	managingApp: string | undefined,
	protocol: "ws" | "http",
): string =>
	(managingApp ? getAppViewHostFromDid(managingApp, protocol) : null) ??
	getAppViewHost(protocol);

export const APPVIEW_FRAGMENT = "colibri_appview";

export const NOTIF_FRAGMENT = "colibri_notifs";

export const getAppViewServiceRef = (url?: string): string =>
	serviceRefFor(getAppViewDid(url), APPVIEW_FRAGMENT);

export const serviceRefFor = (did: string, fragment: string): string =>
	`${did}#${fragment}`;

export const appViewServiceRef = (did: string): string =>
	serviceRefFor(did, APPVIEW_FRAGMENT);

export const notifServiceRef = (did: string): string =>
	serviceRefFor(did, NOTIF_FRAGMENT);

/**
 * Normalizes a user-entered AppView URL into a bare origin (e.g.
 * `https://spaces-api.colibri.social`): trims whitespace, defaults to `https://`
 * when
 * no scheme is given, and drops any path/trailing slash so it can be safely
 * concatenated with an `/xrpc/...` route. Returns `null` when the input isn't a
 * usable http(s) URL.
 */
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

/** Cheap, synchronous shape check used to gate the "Save" button. */
export const isValidAppViewUrl = (raw: string): boolean =>
	normalizeAppViewUrl(raw) !== null;

export const COLIBRI_APPVIEW_SOFTWARE = "colibri-appview";

export interface ColibriServerDescription {
	did: string;
	software: string;
	flavor: string;
	version: string;
	handleDomain: string;
	pds: string;
	contact?: string;
	features?: Array<string>;
	spaceTypes?: Array<string>;
}

/**
 * Probes a URL to confirm it points at a Colibri AppView by calling the public
 * `social.colibri.beta.server.describeServer` endpoint. Returns the server
 * description on success, or `null` if the URL is malformed, unreachable, times
 * out, or responds with anything other than a Colibri AppView.
 */
export const verifyColibriAppView = async (
	raw: string,
): Promise<ColibriServerDescription | null> => {
	const base = normalizeAppViewUrl(raw);
	if (!base) return null;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);

	try {
		const res = await fetch(
			`${base}/xrpc/social.colibri.beta.server.describeServer`,
			{ signal: controller.signal },
		);
		if (!res.ok) return null;

		const data = (await res.json()) as Partial<ColibriServerDescription>;
		if (
			typeof data?.did !== "string" ||
			data.software !== COLIBRI_APPVIEW_SOFTWARE ||
			typeof data.flavor !== "string" ||
			typeof data.version !== "string" ||
			typeof data.handleDomain !== "string" ||
			typeof data.pds !== "string"
		) {
			return null;
		}

		return data as ColibriServerDescription;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
};

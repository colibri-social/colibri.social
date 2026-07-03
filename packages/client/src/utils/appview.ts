const STORAGE_KEY = "colibri:user-preferences";

/**
 * The AppView every install talks to until the user points themselves at a
 * different one. Defined here (rather than imported from the preferences
 * context) so low-level modules like `auth.ts` can resolve it from module scope
 * without pulling in Solid. Keep in sync with the default DID in
 * `atproto/scopes.ts`.
 */
export const DEFAULT_APPVIEW_URL = "https://api.colibri.social";

export const getAppViewHost = (protocol: "ws" | "http") => {
	if (import.meta.env.DEV) return `${protocol}://127.0.0.1:8000`;
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
		return normalizeAppViewUrl(stored ?? "") ?? DEFAULT_APPVIEW_URL;
	} catch {
		return DEFAULT_APPVIEW_URL;
	}
};

/**
 * The `did:web` identifier for an AppView, derived from its host. This is the
 * DID our service-auth `aud`s and OAuth permission-set scopes pin to, so it
 * must match the DID the AppView publishes in its DID document. Defaults to the
 * user's chosen AppView.
 */
export const getAppViewDid = (url: string = getPreferredAppViewUrl()): string =>
	`did:web:${new URL(url).host.replace(/:/g, "%3A")}`;

/** The `did#service` proxy header / service-auth `aud` for the AppView. */
export const getAppViewServiceRef = (url?: string): string =>
	`${getAppViewDid(url)}#colibri_appview`;

/**
 * Normalizes a user-entered AppView URL into a bare origin (e.g.
 * `https://api.colibri.social`): trims whitespace, defaults to `https://` when
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

export interface ColibriServerDescription {
	software: string;
	flavor: string;
	version: string;
}

/**
 * Probes a URL to confirm it points at a Colibri AppView by calling the public
 * `social.colibri.server.describeServer` endpoint. Returns the server
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
			`${base}/xrpc/social.colibri.server.describeServer`,
			{ signal: controller.signal },
		);
		if (!res.ok) return null;

		const data = (await res.json()) as Partial<ColibriServerDescription>;
		if (data?.software !== "colibri-appview" || !data.version) return null;

		return data as ColibriServerDescription;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
};

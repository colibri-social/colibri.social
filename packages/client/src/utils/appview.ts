export const getAppViewHost = (protocol: "ws" | "http") =>
	import.meta.env.DEV
		? `${protocol}://127.0.0.1:8000`
		: `${protocol}s://api.colibri.social`;

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

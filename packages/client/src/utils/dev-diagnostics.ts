import type { PdsStatusReport } from "./appview";

/** Keep in sync with `PDS_UNAVAILABLE` in the AppView's `src/lib/responses.rs`. */
const PDS_UNAVAILABLE = "PdsUnavailable";

const pdsRemediation = () =>
	[
		"The AppView reached for its PDS and didn't find one. Community, channel,",
		"category, role and moderation writes will all keep failing, reads are",
		"unaffected because they're served from the AppView's own record cache.",
		"",
		"Fix: point PDS_LOC in the AppView's .env at a real PDS, then restart it.",
		"`docker-compose.pds.yml` runs a reference PDS locally.",
	].join("\n");

/**
 * Keyed by error code rather than lexicon method: one broken PDS should produce
 * one explanation, not one per request.
 */
const reported = new Set<string>();

const reportOnce = (key: string, emit: () => void): void => {
	if (reported.has(key)) return;
	reported.add(key);
	emit();
};

interface AppViewError {
	error?: string;
	message?: string;
}

const readErrorBody = async (res: Response): Promise<AppViewError | string> => {
	const text = await res.text();
	try {
		return JSON.parse(text) as AppViewError;
	} catch {
		return text;
	}
};

/**
 * Explains a non-OK AppView response. Pass a **clone**, the calling wrapper
 * still reads the original, and a body stream is consumable once.
 */
export const reportXrpcFailure = async (
	method: string,
	res: Response,
): Promise<void> => {
	if (!import.meta.env.DEV) return;

	const body = await readErrorBody(res).catch(() => "<unreadable body>");
	const code = typeof body === "string" ? undefined : body.error;
	const message = typeof body === "string" ? body : body.message;

	reportOnce(code ?? `http:${res.status}`, () => {
		console.group(
			`%c[appview] ${code ?? res.status} — ${method}`,
			"color:#f87171;font-weight:bold",
		);
		console.error(`${res.status} ${res.statusText}`.trim());
		if (message) console.error(message);
		if (code === PDS_UNAVAILABLE) console.info(pdsRemediation());
		console.info(
			"Further failures with this code are suppressed for the rest of the session.",
		);
		console.groupEnd();
	});
};

/** Explains a request that never got a response at all. */
export const reportXrpcNetworkError = (method: string, err: unknown): void => {
	if (!import.meta.env.DEV) return;

	// A refused connection surfaces as an opaque `TypeError: Failed to fetch`,
	// which reads like a client bug.
	const refused = err instanceof TypeError;

	reportOnce(refused ? "transport:refused" : "transport:other", () => {
		console.group(
			`%c[appview] unreachable — ${method}`,
			"color:#f87171;font-weight:bold",
		);
		console.error(err);
		if (refused) {
			console.info(
				"No AppView answered on http://localhost:8000. Start it with `cargo run` in the appview repo.",
			);
		}
		console.groupEnd();
	});
};

/**
 * Reports the AppView's boot-time PDS probe, so a broken `PDS_LOC` is visible
 * at startup rather than after the first write silently fails.
 */
export const reportPdsStatus = (pds: PdsStatusReport | undefined): void => {
	if (!import.meta.env.DEV || !pds || pds.reachable) return;

	reportOnce("boot:pds", () => {
		console.group(
			"%c[appview] no PDS connected",
			"color:#fbbf24;font-weight:bold",
		);
		console.warn(
			pds.configured
				? `The AppView's PDS probe reported: ${pds.status}.`
				: "The AppView has no usable PDS_LOC configured.",
		);
		console.info(pdsRemediation());
		console.groupEnd();
	});
};

import * as Sentry from "@sentry/solid";
import { classifyThrown } from "./classify";
import { isReportableCode } from "./codes";
import { type ColibriError, isColibriError } from "./error";

export interface ReportOptions {
	stage?: string;
	method?: string;
	tags?: Record<string, string>;
	context?: Record<string, unknown>;
	contexts?: Record<string, Record<string, unknown>>;
	fingerprint?: string;
	severity?: ColibriError["severity"];
}

type DiagnosticsProvider = () => Record<string, unknown> | undefined;

let diagnosticsProvider: DiagnosticsProvider | undefined;

export const setDiagnosticsProvider = (provider: DiagnosticsProvider): void => {
	diagnosticsProvider = provider;
};

const SUPPRESSION_WINDOW_MS = 60_000;
const MAX_TRACKED_FINGERPRINTS = 200;

interface Seen {
	atMs: number;
	eventId: string | undefined;
}

const seen = new Map<string, Seen>();

const fingerprintOf = (err: ColibriError, options: ReportOptions): string => {
	if (options.fingerprint) return options.fingerprint;
	if (err.domain === "transport") return `transport|${err.code}`;
	return [
		err.code,
		err.status ?? "",
		err.method ?? options.method ?? "",
		options.stage ?? "",
	].join("|");
};

const suppressedEventId = (
	fingerprint: string,
	nowMs: number,
):
	| { suppressed: true; eventId: string | undefined }
	| { suppressed: false } => {
	const previous = seen.get(fingerprint);
	if (previous && nowMs - previous.atMs < SUPPRESSION_WINDOW_MS) {
		return { suppressed: true, eventId: previous.eventId };
	}
	if (seen.size >= MAX_TRACKED_FINGERPRINTS) {
		const oldest = seen.keys().next();
		if (!oldest.done) seen.delete(oldest.value);
	}
	seen.set(fingerprint, { atMs: nowMs, eventId: undefined });
	return { suppressed: false };
};

const remember = (fingerprint: string, eventId: string | undefined): void => {
	const entry = seen.get(fingerprint);
	if (entry) entry.eventId = eventId;
};

const severityToLevel = (
	severity: ColibriError["severity"],
): "info" | "warning" | "error" | "fatal" =>
	severity === "warning"
		? "warning"
		: severity === "info"
			? "info"
			: severity === "fatal"
				? "fatal"
				: "error";

export const resetReportSuppression = (): void => {
	seen.clear();
};

export const reportError = (
	err: unknown,
	options: ReportOptions = {},
): ColibriError => {
	const classified = isColibriError(err)
		? err
		: classifyThrown(err, { method: options.method, context: options.context });

	if (options.context) classified.withContext(options.context);

	if (!isReportableCode(classified.code)) return classified;

	const fingerprint = fingerprintOf(classified, options);
	const throttle = suppressedEventId(fingerprint, Date.now());

	// Throttling exists to spare Sentry a flood of one repeating failure, not to
	// strip the reference the user is told to quote. A repeat of the same
	// fingerprint is the same Sentry issue, so hand back the first event's id.
	if (throttle.suppressed) {
		classified.eventId = throttle.eventId;
		return classified;
	}

	const eventId = Sentry.withScope((scope) => {
		scope.setFingerprint(
			classified.code === "Unexpected"
				? ["{{ default }}", fingerprint]
				: [fingerprint],
		);
		scope.setTag("error.code", classified.code);
		scope.setTag("error.domain", classified.domain);
		scope.setTag("error.retryable", String(classified.retryable));
		if (classified.status !== undefined) {
			scope.setTag("error.status", String(classified.status));
		}
		const method = classified.method ?? options.method;
		if (method) scope.setTag("error.method", method);
		if (options.stage) scope.setTag("error.stage", options.stage);
		for (const [key, value] of Object.entries(options.tags ?? {})) {
			scope.setTag(key, value);
		}

		scope.setLevel(severityToLevel(classified.severity));
		scope.setContext("error", {
			code: classified.code,
			domain: classified.domain,
			status: classified.status,
			method,
			retryable: classified.retryable,
			retryAfterMs: classified.retryAfterMs,
			serverMessage: classified.serverMessage,
			fields: classified.fields,
		});
		if (Object.keys(classified.context).length > 0) {
			scope.setContext("details", classified.context);
		}
		for (const [name, values] of Object.entries(options.contexts ?? {})) {
			scope.setContext(name, values);
		}
		const diagnostics = diagnosticsProvider?.();
		if (diagnostics) scope.setContext("diagnostics", diagnostics);

		return Sentry.captureException(classified);
	});

	if (typeof eventId === "string" && eventId !== "") {
		classified.eventId = eventId;
	}
	remember(fingerprint, classified.eventId);

	return classified;
};

export const reportRecovered = (
	message: string,
	options: ReportOptions = {},
): void => {
	Sentry.withScope((scope) => {
		scope.setLevel("info");
		if (options.stage) scope.setTag("error.stage", options.stage);
		for (const [key, value] of Object.entries(options.tags ?? {})) {
			scope.setTag(key, value);
		}
		if (options.context) scope.setContext("details", options.context);
		Sentry.captureMessage(message, "info");
	});
};

export const attachAccountToReport = (
	eventId: string | undefined,
	did: string,
	note?: string,
): boolean => {
	if (!eventId || !did) return false;

	const message = note?.trim()
		? note.trim()
		: "The person hitting this error chose to send their account identifier.";

	Sentry.withScope((scope) => {
		scope.setUser({ id: did });
		scope.setTag("account.attached", "true");
		Sentry.captureFeedback({ message, associatedEventId: eventId });
	});

	return true;
};

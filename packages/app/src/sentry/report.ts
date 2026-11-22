import {
	type ColibriError,
	classifyThrown,
	isColibriError,
	isReportableCode,
} from "@colibri-social/lib";
import * as Sentry from "@sentry/solid";

export interface ReportOptions {
	stage?: string;
	method?: string;
	tags?: Record<string, string>;
	context?: Record<string, unknown>;
	contexts?: Record<string, Record<string, unknown>>;
	fingerprint?: string;
	severity?: ColibriError["severity"];
	force?: boolean;
}

const SUPPRESSION_WINDOW_MS = 60_000;
const MAX_TRACKED_FINGERPRINTS = 200;
const TRANSPORT_FAILURES_UNTIL_REPORTED = 3;

interface Seen {
	atMs: number;
	eventId: string | undefined;
	failures: number;
	reported: boolean;
}

const seen = new Map<string, Seen>();

const XRPC_NOT_SUPPORTED = "XRPCNotSupported";

const isAppViewOutage = (err: ColibriError): boolean =>
	(err.code === "UpstreamFailure" && (err.status ?? 0) >= 500) ||
	(err.code === "NotFound" && err.context.unknownCode === XRPC_NOT_SUPPORTED);

const fingerprintOf = (err: ColibriError, options: ReportOptions): string => {
	if (options.fingerprint) return options.fingerprint;
	if (err.domain === "transport") return `transport|${err.code}`;
	if (isAppViewOutage(err)) return `appview|${err.code}`;
	return [
		err.code,
		err.status ?? "",
		err.method ?? options.method ?? "",
		options.stage ?? "",
	].join("|");
};

const failuresUntilReported = (err: ColibriError): number =>
	err.domain === "transport" ? TRANSPORT_FAILURES_UNTIL_REPORTED : 1;

const suppressedEventId = (
	fingerprint: string,
	nowMs: number,
	untilReported: number,
):
	| { suppressed: true; eventId: string | undefined }
	| { suppressed: false } => {
	const previous = seen.get(fingerprint);
	if (previous && nowMs - previous.atMs < SUPPRESSION_WINDOW_MS) {
		previous.failures += 1;
		if (previous.reported || previous.failures < untilReported) {
			return { suppressed: true, eventId: previous.eventId };
		}
		previous.reported = true;
		return { suppressed: false };
	}
	if (seen.size >= MAX_TRACKED_FINGERPRINTS) {
		const oldest = seen.keys().next();
		if (!oldest.done) seen.delete(oldest.value);
	}
	const reported = untilReported <= 1;
	seen.set(fingerprint, {
		atMs: nowMs,
		eventId: undefined,
		failures: 1,
		reported,
	});
	return reported
		? { suppressed: false }
		: { suppressed: true, eventId: undefined };
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

	if (!options.force && !isReportableCode(classified.code)) return classified;

	const fingerprint = fingerprintOf(classified, options);
	const throttle = suppressedEventId(
		fingerprint,
		Date.now(),
		failuresUntilReported(classified),
	);

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

		return Sentry.captureException(classified);
	});

	if (typeof eventId === "string" && eventId !== "") {
		classified.eventId = eventId;
	}
	remember(fingerprint, classified.eventId);

	return classified;
};

export const attachAccountToReport = (
	eventId: string | undefined,
	did: string,
): boolean => {
	if (!eventId || !did) return false;

	Sentry.withScope((scope) => {
		scope.setUser({ id: did });
		scope.setTag("account.attached", "true");
		Sentry.captureFeedback({
			message:
				"The person hitting this error chose to send their account identifier.",
			associatedEventId: eventId,
		});
	});

	return true;
};

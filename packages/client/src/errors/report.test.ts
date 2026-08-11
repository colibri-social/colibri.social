import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let captured = 0;
const captureException = vi.fn((_err: unknown) => {
	captured += 1;
	return `event-${captured}`;
});

let fingerprints: Array<Array<string>> = [];

vi.mock("@sentry/solid", () => {
	const scope = {
		setTag: () => scope,
		setUser: () => scope,
		setContext: () => scope,
		setExtra: () => scope,
		setLevel: () => scope,
		setFingerprint: (value: Array<string>) => {
			fingerprints.push(value);
			return scope;
		},
	};
	return {
		captureException: (err: unknown) => captureException(err),
		captureMessage: () => "",
		captureFeedback: () => "",
		addBreadcrumb: () => {},
		setUser: () => {},
		withScope: (fn: (s: typeof scope) => unknown) => fn(scope),
	};
});

const { reportError, resetReportSuppression } = await import("./report");
const { ColibriError } = await import("./error");

beforeEach(() => {
	resetReportSuppression();
	captured = 0;
	fingerprints = [];
	captureException.mockClear();
});

afterEach(() => vi.useRealTimers());

const crash = () => new ColibriError({ code: "Unexpected", method: "boom" });

describe("reportError", () => {
	it("returns an event id for a first occurrence", () => {
		expect(reportError(crash()).eventId).toBe("event-1");
	});

	it("only sends the same failure to Sentry once per window", () => {
		reportError(crash());
		reportError(crash());
		expect(captureException).toHaveBeenCalledTimes(1);
	});

	it("still hands back the reference on a suppressed repeat", () => {
		const first = reportError(crash()).eventId;
		const second = reportError(crash()).eventId;

		expect(first).toBe("event-1");
		expect(second).toBe(first);
	});

	it("sends again once the window has passed", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		reportError(crash());

		vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
		const later = reportError(crash());

		expect(captureException).toHaveBeenCalledTimes(2);
		expect(later.eventId).toBe("event-2");
	});

	it("treats a different failure as its own issue", () => {
		reportError(crash());
		const other = reportError(new ColibriError({ code: "Forbidden" }));

		expect(captureException).toHaveBeenCalledTimes(2);
		expect(other.eventId).toBe("event-2");
	});

	it.each([
		"DevicePermissionDenied",
		"DeviceUnavailable",
		"NativeCancelled",
		"HandleNotFound",
		"OAuthDenied",
		"Offline",
	] as const)("does not send %s to Sentry", (code) => {
		const classified = reportError(new ColibriError({ code }));

		expect(captureException).not.toHaveBeenCalled();
		expect(classified.code).toBe(code);
		expect(classified.eventId).toBeUndefined();
	});

	it("collapses transport failures across methods into one issue", () => {
		reportError(new ColibriError({ code: "Timeout", method: "a.b.c" }), {
			stage: "xrpc",
		});
		reportError(new ColibriError({ code: "Timeout", method: "d.e.f" }), {
			stage: "xrpc",
		});
		reportError(new ColibriError({ code: "NetworkFailed", method: "g.h.i" }));

		expect(captureException).toHaveBeenCalledTimes(2);
	});

	it("keeps our own failures separated by method", () => {
		reportError(new ColibriError({ code: "MalformedResponse", method: "a.b" }));
		reportError(new ColibriError({ code: "MalformedResponse", method: "c.d" }));

		expect(captureException).toHaveBeenCalledTimes(2);
	});

	it("groups a classified failure by its own key, not by message text", () => {
		reportError(
			new ColibriError({
				code: "AuthRequired",
				status: 401,
				method: "social.colibri.actor.getData",
				serverMessage: 'Unknown authorization session "Xpd91RsWd7yNPptJ_RDp7Q"',
			}),
			{ stage: "xrpc" },
		);

		expect(fingerprints).toEqual([
			["AuthRequired|401|social.colibri.actor.getData|xrpc"],
		]);
	});

	it("gives two sessions with different ids the same grouping key", () => {
		const of = (id: string) =>
			new ColibriError({
				code: "AuthRequired",
				status: 401,
				method: "social.colibri.actor.getData",
				serverMessage: `Unknown authorization session "${id}"`,
			});

		reportError(of("aaa"), { stage: "xrpc" });
		resetReportSuppression();
		reportError(of("bbb"), { stage: "xrpc" });

		expect(fingerprints[0]).toEqual(fingerprints[1]);
	});

	it("keeps Sentry's own grouping for an unknown failure", () => {
		reportError(new ColibriError({ code: "Unexpected", method: "boom" }));

		expect(fingerprints[0]?.[0]).toBe("{{ default }}");
	});

	it("groups transport failures by code alone", () => {
		reportError(new ColibriError({ code: "Timeout", method: "a.b.c" }), {
			stage: "xrpc",
		});

		expect(fingerprints).toEqual([["transport|Timeout"]]);
	});

	it("still sends a failure that is ours to fix", () => {
		reportError(new ColibriError({ code: "MalformedResponse" }));

		expect(captureException).toHaveBeenCalledTimes(1);
	});
});

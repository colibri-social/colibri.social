import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let captured = 0;
const captureException = vi.fn((_err: unknown) => {
	captured += 1;
	return `event-${captured}`;
});

vi.mock("@sentry/solid", () => {
	const scope = {
		setTag: () => scope,
		setUser: () => scope,
		setContext: () => scope,
		setExtra: () => scope,
		setLevel: () => scope,
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
});

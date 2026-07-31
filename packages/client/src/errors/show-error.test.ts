import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("somoto", () => ({
	toast: { error: (...args: Array<unknown>) => toastError(...args) },
}));

const { showError } = await import("./show-error");
const { ColibriError } = await import("./error");

afterEach(() => {
	toastError.mockClear();
	vi.unstubAllGlobals();
});

const optionsOf = () => toastError.mock.calls[0]?.[1] as { action?: unknown };

describe("showError", () => {
	it("offers Retry for a retryable error", () => {
		showError(new ColibriError({ code: "RateLimited" }), {
			retry: () => {},
			report: false,
		});
		expect(optionsOf().action).toBeDefined();
	});

	it("does not offer Retry for a terminal error, even when given a callback", () => {
		showError(new ColibriError({ code: "Forbidden" }), {
			retry: () => {},
			report: false,
		});
		expect(optionsOf().action).toBeUndefined();
	});

	it("offers Retry for an unrecognised value, which could be anything", () => {
		showError(new Error("boom"), { retry: () => {}, report: false });
		expect(optionsOf().action).toBeDefined();
	});

	it("offers nothing when no callback was given", () => {
		showError(new ColibriError({ code: "RateLimited" }), { report: false });
		expect(optionsOf().action).toBeUndefined();
	});

	it("uses the curated title and description", () => {
		showError(new ColibriError({ code: "Forbidden" }), { report: false });
		expect(toastError.mock.calls[0]?.[0]).toBe(
			"You don't have permission to do that.",
		);
		expect(optionsOf()).toMatchObject({
			description: "Ask a moderator if you think you should.",
		});
	});

	it("lets a caller override the title without losing the catalog description", () => {
		showError(new ColibriError({ code: "Forbidden" }), {
			fallbackTitle: "Couldn't kick that member.",
			report: false,
		});
		expect(toastError.mock.calls[0]?.[0]).toBe("Couldn't kick that member.");
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
const toastDismiss = vi.fn();
vi.mock("somoto", () => ({
	toast: { error: toastError, dismiss: toastDismiss },
}));

const {
	resetCrossAppViewHint,
	setCrossAppViewHintHandlers,
	showCrossAppViewHint,
} = await import("./cross-appview-hint");

describe("showCrossAppViewHint", () => {
	let suppressed: boolean;
	const enable = vi.fn();
	const suppress = vi.fn(() => {
		suppressed = true;
	});

	beforeEach(() => {
		suppressed = false;
		toastError.mockClear();
		toastDismiss.mockClear();
		enable.mockClear();
		suppress.mockClear();
		resetCrossAppViewHint();
		setCrossAppViewHintHandlers({
			isSuppressed: () => suppressed,
			suppressPermanently: suppress,
			enablePresenceSharing: enable,
		});
	});

	it("shows at most once per session", () => {
		expect(showCrossAppViewHint()).toBe(true);
		expect(showCrossAppViewHint()).toBe(false);
		expect(toastError).toHaveBeenCalledTimes(1);
	});

	it("stays quiet once the user has opted out", () => {
		suppressed = true;
		expect(showCrossAppViewHint()).toBe(false);
		expect(toastError).not.toHaveBeenCalled();
	});

	it("offers turning presence sharing on", () => {
		showCrossAppViewHint();
		const options = toastError.mock.calls[0]?.[1];
		options.action.onClick();
		expect(enable).toHaveBeenCalledOnce();
		expect(toastDismiss).toHaveBeenCalledOnce();
	});

	it("stays up long enough to be acted on", () => {
		showCrossAppViewHint();
		expect(toastError.mock.calls[0]?.[1].duration).toBeGreaterThanOrEqual(
			10_000,
		);
	});

	it("offers suppressing itself for good", () => {
		showCrossAppViewHint();
		const options = toastError.mock.calls[0]?.[1];
		options.cancel.onClick();
		expect(suppress).toHaveBeenCalledOnce();
		expect(toastDismiss).toHaveBeenCalledOnce();

		resetCrossAppViewHint();
		expect(showCrossAppViewHint()).toBe(false);
	});

	it("does nothing before the handlers are registered", () => {
		setCrossAppViewHintHandlers(undefined as never);
		expect(showCrossAppViewHint()).toBe(false);
	});
});

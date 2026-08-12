import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import {
	activeLoadingRequest,
	type LoadingRequest,
	loadingRequests,
	overlayEnterDelay,
	requestLoadingOverlay,
} from "./loading-overlay-state";

const req = (message: string, delay = 0): LoadingRequest => ({
	message: () => message,
	phase: () => "syncing",
	flavor: () => true,
	delay: () => delay,
});

describe("overlayEnterDelay", () => {
	it("shows straight away with nothing pending", () => {
		expect(overlayEnterDelay([])).toBe(0);
	});

	it("honours a single request's delay", () => {
		expect(overlayEnterDelay([req("community", 250)])).toBe(250);
	});

	it("lets the most impatient request win", () => {
		expect(overlayEnterDelay([req("community", 250), req("boot", 0)])).toBe(0);
		expect(overlayEnterDelay([req("slow", 400), req("less slow", 120)])).toBe(
			120,
		);
	});

	it("treats a negative delay as immediate", () => {
		expect(overlayEnterDelay([req("odd", -50)])).toBe(0);
	});
});

describe("requestLoadingOverlay", () => {
	it("pops the request when its owner is disposed", () => {
		const dispose = createRoot((disposeRoot) => {
			requestLoadingOverlay(req("community", 250));
			return disposeRoot;
		});

		expect(loadingRequests()).toHaveLength(1);
		expect(activeLoadingRequest()?.message()).toBe("community");

		dispose();

		expect(loadingRequests()).toHaveLength(0);
		expect(overlayEnterDelay(loadingRequests())).toBe(0);
	});

	it("hands the overlay to the newest request and back again", () => {
		const disposeFirst = createRoot((disposeRoot) => {
			requestLoadingOverlay(req("user", 0));
			return disposeRoot;
		});
		const disposeSecond = createRoot((disposeRoot) => {
			requestLoadingOverlay(req("community", 250));
			return disposeRoot;
		});

		expect(activeLoadingRequest()?.message()).toBe("community");
		expect(overlayEnterDelay(loadingRequests())).toBe(0);

		disposeFirst();

		expect(activeLoadingRequest()?.message()).toBe("community");
		expect(overlayEnterDelay(loadingRequests())).toBe(250);

		disposeSecond();

		expect(loadingRequests()).toHaveLength(0);
	});
});

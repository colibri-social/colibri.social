import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import {
	communityRefreshStale,
	trackCommunityRefresh,
} from "./community-refresh-state";

const track = (initial: boolean) => {
	let setFailed: (value: boolean) => void = () => {};

	const dispose = createRoot((disposeRoot) => {
		const [failed, set] = createSignal(initial);
		setFailed = set;
		trackCommunityRefresh(failed);
		return disposeRoot;
	});

	return { setFailed, dispose };
};

describe("trackCommunityRefresh", () => {
	it("starts quiet", () => {
		const { dispose } = track(false);

		expect(communityRefreshStale()).toBe(false);
		dispose();
	});

	it("raises the notice when the refresh fails", () => {
		const { setFailed, dispose } = track(false);

		setFailed(true);
		expect(communityRefreshStale()).toBe(true);

		dispose();
	});

	it("clears the notice when the refresh recovers", () => {
		const { setFailed, dispose } = track(true);

		expect(communityRefreshStale()).toBe(true);
		setFailed(false);
		expect(communityRefreshStale()).toBe(false);

		dispose();
	});

	it("clears the notice when the community it belongs to goes away", () => {
		const { dispose } = track(true);

		expect(communityRefreshStale()).toBe(true);
		dispose();

		expect(communityRefreshStale()).toBe(false);
	});
});

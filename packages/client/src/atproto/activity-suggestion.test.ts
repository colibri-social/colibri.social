import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColibriClient } from "./xrpc";

const DID = "did:plc:t4ckug4y36pkmxo5ej75v3ug";

const hasActivitySource = vi.fn<(did: string) => Promise<boolean>>();
const getPreferences = vi.fn();

vi.mock("./teal-source", () => ({ hasActivitySource }));
vi.mock("./notificationPreference", () => ({
	getPreferences,
	shareActivityOf: (preferences: { shareActivity?: boolean }) =>
		preferences.shareActivity === true,
}));

const xrpc = {} as ColibriClient;

const preferences = (shareActivity: boolean) => ({
	ok: true as const,
	data: { preferences: { shareActivity } },
});

const load = async () => {
	vi.resetModules();
	return await import("./activity-suggestion");
};

const settle = async () => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe("startActivitySuggestion", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		hasActivitySource.mockReset();
		getPreferences.mockReset();
		hasActivitySource.mockResolvedValue(true);
		getPreferences.mockResolvedValue(preferences(false));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("has the suggestion ready before anything asks for it", async () => {
		const { startActivitySuggestion, suggestActivity } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();

		expect(suggestActivity()).toBe(true);
		expect(hasActivitySource).toHaveBeenCalledTimes(1);
		stop();
	});

	it("offers nothing while the records are still unknown", async () => {
		const { startActivitySuggestion, suggestActivity } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});

		expect(suggestActivity()).toBe(false);
		stop();
	});

	it("offers nothing to someone who already shares", async () => {
		getPreferences.mockResolvedValue(preferences(true));
		const { startActivitySuggestion, suggestActivity } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();

		expect(suggestActivity()).toBe(false);
		stop();
	});

	it("offers nothing to someone with no teal.fm records", async () => {
		hasActivitySource.mockResolvedValue(false);
		const { startActivitySuggestion, suggestActivity } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();

		expect(suggestActivity()).toBe(false);
		stop();
	});

	it("keeps looking, so connecting teal.fm mid-session is picked up", async () => {
		hasActivitySource.mockResolvedValue(false);
		const { startActivitySuggestion, suggestActivity, SOURCE_POLL_MS } =
			await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();
		expect(suggestActivity()).toBe(false);

		hasActivitySource.mockResolvedValue(true);
		await vi.advanceTimersByTimeAsync(SOURCE_POLL_MS);
		await settle();

		expect(suggestActivity()).toBe(true);
		stop();
	});

	it("stops looking once the records are found", async () => {
		const { startActivitySuggestion, SOURCE_POLL_MS } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();
		await vi.advanceTimersByTimeAsync(SOURCE_POLL_MS * 3);

		expect(hasActivitySource).toHaveBeenCalledTimes(1);
		stop();
	});

	it("stops looking for someone who hid the suggestion", async () => {
		hasActivitySource.mockResolvedValue(false);
		const { startActivitySuggestion, SOURCE_POLL_MS } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => true,
		});
		await settle();
		await vi.advanceTimersByTimeAsync(SOURCE_POLL_MS * 2);

		expect(hasActivitySource).toHaveBeenCalledTimes(1);
		stop();
	});

	it("looks nothing up after it is stopped", async () => {
		hasActivitySource.mockResolvedValue(false);
		const { startActivitySuggestion, SOURCE_POLL_MS } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();
		stop();
		await vi.advanceTimersByTimeAsync(SOURCE_POLL_MS * 2);

		expect(hasActivitySource).toHaveBeenCalledTimes(1);
	});

	it("takes the sharing preference from a live update", async () => {
		const { startActivitySuggestion, suggestActivity, noteActivitySharing } =
			await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();
		expect(suggestActivity()).toBe(true);

		noteActivitySharing(true);
		expect(suggestActivity()).toBe(false);
		stop();
	});

	it("carries on when the preference cannot be read", async () => {
		getPreferences.mockResolvedValue({
			ok: false as const,
			error: { code: "upstream" },
		});
		const { startActivitySuggestion, suggestActivity } = await load();

		const stop = startActivitySuggestion({
			did: DID,
			xrpc,
			dismissed: () => false,
		});
		await settle();

		expect(suggestActivity()).toBe(false);
		stop();
	});
});

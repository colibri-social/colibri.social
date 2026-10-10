import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileView } from "../atproto/views";
import { createActorLookup } from "./actor-lookup";

const DID = "did:plc:7fkdlwjqmzcuvvpjbztkaaaa";
const PROFILE = { did: DID, handle: "alice.test" } as unknown as ProfileView;

describe("createActorLookup", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("retries a failed lookup until it succeeds", async () => {
		const fetchProfile = vi
			.fn<(did: string) => Promise<ProfileView | undefined>>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(PROFILE);
		const remember = vi.fn();
		const lookup = createActorLookup(fetchProfile, remember, [100, 200]);

		lookup.request(DID);
		await vi.advanceTimersByTimeAsync(0);
		expect(remember).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(100);
		expect(fetchProfile).toHaveBeenCalledTimes(2);
		expect(remember).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(200);
		expect(fetchProfile).toHaveBeenCalledTimes(3);
		expect(remember).toHaveBeenCalledWith(PROFILE);
	});

	it("dedupes requests while a lookup is pending", async () => {
		const fetchProfile = vi.fn(async () => PROFILE);
		const lookup = createActorLookup(fetchProfile, vi.fn(), []);

		lookup.request(DID);
		lookup.request(DID);
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchProfile).toHaveBeenCalledTimes(1);
	});

	it("allows a fresh request after the retries run out", async () => {
		const fetchProfile = vi.fn(async () => undefined);
		const lookup = createActorLookup(fetchProfile, vi.fn(), [100]);

		lookup.request(DID);
		await vi.advanceTimersByTimeAsync(100);
		expect(fetchProfile).toHaveBeenCalledTimes(2);

		lookup.request(DID);
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchProfile).toHaveBeenCalledTimes(3);
	});

	it("stops retrying once disposed", async () => {
		const fetchProfile = vi.fn(async () => undefined);
		const lookup = createActorLookup(fetchProfile, vi.fn(), [100, 200]);

		lookup.request(DID);
		await vi.advanceTimersByTimeAsync(0);
		lookup.dispose();
		await vi.advanceTimersByTimeAsync(1000);

		expect(fetchProfile).toHaveBeenCalledTimes(1);
	});
});

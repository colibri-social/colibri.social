import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type HostAuthorization,
	HostSignInError,
	toHostAuthorization,
	waitForHostAuthorization,
} from "./hosting";

afterEach(() => {
	vi.useRealTimers();
});

describe("host sign-in outcomes", () => {
	it("reads the AppView's answer", () => {
		expect(toHostAuthorization({ status: "pending" })).toEqual({
			status: "pending",
		});
		expect(
			toHostAuthorization({ status: "done", community: "did:plc:owls" }),
		).toEqual({ status: "done", community: "did:plc:owls" });
		expect(
			toHostAuthorization({
				status: "failed",
				failure: "wrongAccount",
				signedInAs: "alex.example.com",
			}),
		).toEqual({
			status: "failed",
			failure: "wrongAccount",
			signedInAs: "alex.example.com",
		});
		expect(
			toHostAuthorization({ status: "failed", failure: "somethingNew" }),
		).toEqual({ status: "failed", failure: "failed" });
	});

	it("waits until the sign-in finishes", async () => {
		const answers: HostAuthorization[] = [
			{ status: "pending" },
			{ status: "done", community: "did:plc:owls" as never },
		];
		const source = {
			getCommunityHostAuthorization: vi.fn(
				async () => answers.shift() ?? { status: "pending" as const },
			),
		};

		await expect(
			waitForHostAuthorization(source, "request-1", { intervalMs: 5 }),
		).resolves.toEqual({ status: "done", community: "did:plc:owls" });
		expect(source.getCommunityHostAuthorization).toHaveBeenCalledWith(
			"request-1",
		);
	});

	it("stops waiting when the user goes back", async () => {
		const controller = new AbortController();
		const source = {
			getCommunityHostAuthorization: async () => ({
				status: "pending" as const,
			}),
		};
		const waiting = waitForHostAuthorization(source, "request-1", {
			intervalMs: 5,
			signal: controller.signal,
		});
		controller.abort();

		await expect(waiting).rejects.toBeInstanceOf(HostSignInError);
	});
});

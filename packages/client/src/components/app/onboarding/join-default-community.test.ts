import { describe, expect, it, vi } from "vitest";
import { colibri } from "../../../atproto/lexicons";
import type { LoggedInUser } from "../../../contexts/User";
import { joinDefaultCommunity } from "./join-default-community";

const COMMUNITY = "did:plc:mprdjqjluoswa7awzggaggj3";

const userWith = (
	call: ReturnType<typeof vi.fn>,
	communities: Array<{ did: string }> = [],
) =>
	({
		communities,
		xrpc: { call },
		refetchCommunities: vi.fn(async () => {}),
	}) as unknown as LoggedInUser;

describe("joinDefaultCommunity", () => {
	it("does nothing when the AppView names no default community", async () => {
		const call = vi.fn();
		await joinDefaultCommunity(userWith(call), async () => undefined);
		expect(call).not.toHaveBeenCalled();
	});

	it("does nothing when the user is already a member", async () => {
		const call = vi.fn();
		await joinDefaultCommunity(
			userWith(call, [{ did: COMMUNITY }]),
			async () => COMMUNITY,
		);
		expect(call).not.toHaveBeenCalled();
	});

	it("joins the default community and refreshes the community list", async () => {
		const call = vi.fn(async () => ({ ok: true, data: { status: "joined" } }));
		const user = userWith(call);
		await joinDefaultCommunity(user, async () => COMMUNITY);
		expect(call).toHaveBeenCalledWith(
			colibri.community.join.main,
			{ body: { community: COMMUNITY } },
			expect.anything(),
		);
		expect(user.refetchCommunities).toHaveBeenCalled();
	});

	it("swallows a failed join", async () => {
		const call = vi.fn(async () => ({ ok: false, error: new Error("nope") }));
		const user = userWith(call);
		await expect(
			joinDefaultCommunity(user, async () => COMMUNITY),
		).resolves.toBeUndefined();
		expect(user.refetchCommunities).not.toHaveBeenCalled();
	});

	it("swallows a failed describeServer read", async () => {
		const call = vi.fn();
		await expect(
			joinDefaultCommunity(userWith(call), async () => {
				throw new TypeError("Failed to fetch");
			}),
		).resolves.toBeUndefined();
		expect(call).not.toHaveBeenCalled();
	});
});

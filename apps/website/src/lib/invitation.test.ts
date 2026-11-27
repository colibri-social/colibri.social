import { afterEach, describe, expect, it, vi } from "vitest";
import { getInvitationPreview, invitePath, parseInvite } from "./invitation";

vi.mock("@/lib/handle", () => ({ resolveHandle: async () => null }));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("parseInvite", () => {
	it("reads a bare code and a code with the Space that issued it", () => {
		expect(parseInvite("abc123")).toEqual({ code: "abc123" });
		expect(parseInvite("did:plc:space/abc123")).toEqual({
			code: "abc123",
			community: "did:plc:space",
		});
	});

	it("refuses paths that aren't an invite", () => {
		expect(parseInvite(undefined)).toBeNull();
		expect(parseInvite("")).toBeNull();
		expect(parseInvite("space/abc123")).toBeNull();
		expect(parseInvite("did:plc:space/abc123/extra")).toBeNull();
	});
});

describe("invitePath", () => {
	it("round-trips through parseInvite", () => {
		const target = { code: "abc123", community: "did:plc:space" };

		expect(parseInvite(decodeURIComponent(invitePath(target)))).toEqual(target);
		expect(invitePath({ code: "abc123" })).toBe("abc123");
	});
});

describe("getInvitationPreview", () => {
	it("asks the AppView for the code within the Space the link names", async () => {
		const fetch = vi.fn(async () => new Response("", { status: 404 }));

		vi.stubGlobal("fetch", fetch);

		await getInvitationPreview({ code: "abc123", community: "did:plc:space" });

		const [url] = fetch.mock.calls[0] as unknown as [URL];

		expect(url.searchParams.get("code")).toBe("abc123");
		expect(url.searchParams.get("community")).toBe("did:plc:space");
	});
});

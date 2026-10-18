import { ColibriError } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import {
	captureWebLinkOutcome,
	createSupporterLinkTransport,
	LABELER_DID,
	LINK_METHOD,
	type LinkOutcome,
	linkErrorMessage,
	listenForLinkOutcomes,
	readLinkOutcome,
	UNLINK_METHOD,
} from "./supporter-link";

const respond = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });

const transportWith = (fetcher: typeof fetch, native = false) => {
	const serviceAuth = vi.fn(async () => "service-token");
	const transport = createSupporterLinkTransport({
		serviceAuth,
		native: () => native,
		url: "https://labeler.example",
		fetcher,
		now: () => 1_000_000,
	});
	return { transport, serviceAuth };
};

describe("createSupporterLinkTransport", () => {
	it("mints a labeler token and starts the link", async () => {
		const fetcher = vi.fn(async () =>
			respond({ authorizeUrl: "https://opencollective.com/oauth" }),
		);
		const { transport, serviceAuth } = transportWith(fetcher, true);
		await expect(transport.start()).resolves.toBe(
			"https://opencollective.com/oauth",
		);
		expect(serviceAuth).toHaveBeenCalledWith({
			aud: `${LABELER_DID}#atproto_labeler`,
			lxm: LINK_METHOD,
			exp: 1060,
		});
		const [url, init] = fetcher.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe(`https://labeler.example/xrpc/${LINK_METHOD}`);
		expect(new Headers(init.headers).get("authorization")).toBe(
			"Bearer service-token",
		);
		expect(JSON.parse(String(init.body))).toEqual({
			platform: "opencollective",
			native: true,
		});
	});

	it("rejects a start response without a URL", async () => {
		const { transport } = transportWith(vi.fn(async () => respond({})));
		await expect(transport.start()).rejects.toMatchObject({
			code: "MalformedResponse",
		});
	});

	it("unlinks and reports the removed badges", async () => {
		const fetcher = vi.fn(async () =>
			respond({ unlinked: true, negatedLabelVals: ["backer-five"] }),
		);
		const { transport, serviceAuth } = transportWith(fetcher);
		await expect(transport.unlink()).resolves.toEqual({
			unlinked: true,
			negatedLabelVals: ["backer-five"],
		});
		expect(serviceAuth).toHaveBeenCalledWith(
			expect.objectContaining({ lxm: UNLINK_METHOD }),
		);
	});

	it("classifies labeler failures", async () => {
		const { transport } = transportWith(
			vi.fn(async () => respond({ error: "AuthRequired" }, 401)),
		);
		const error = await transport.unlink().catch((caught) => caught);
		expect(error).toBeInstanceOf(ColibriError);
		expect((error as ColibriError).method).toBe(UNLINK_METHOD);
	});
});

describe("readLinkOutcome", () => {
	it("reads a completed link", () => {
		expect(
			readLinkOutcome(new URLSearchParams("oc=linked&account=lou")),
		).toEqual({ status: "linked", account: "lou" });
	});

	it("reads a failed link with a fallback reason", () => {
		expect(readLinkOutcome(new URLSearchParams("oc=error"))).toEqual({
			status: "error",
			reason: "LinkFailed",
		});
	});

	it("ignores unrelated params", () => {
		expect(readLinkOutcome(new URLSearchParams("oc=maybe"))).toBe(undefined);
		expect(readLinkOutcome(new URLSearchParams("code=1"))).toBe(undefined);
	});
});

describe("link outcomes", () => {
	it("holds an outcome until a listener mounts", () => {
		const replaceState = vi.fn();
		captureWebLinkOutcome(
			{ href: "https://colibri.social/app?oc=error&reason=GuestAccount&x=1" },
			{ state: { colibriDepth: 0 }, replaceState },
		);
		expect(replaceState).toHaveBeenCalledWith(
			{ colibriDepth: 0 },
			"",
			new URL("https://colibri.social/app?x=1"),
		);
		const seen: LinkOutcome[] = [];
		const stop = listenForLinkOutcomes((outcome) => seen.push(outcome));
		expect(seen).toEqual([{ status: "error", reason: "GuestAccount" }]);
		stop();
	});

	it("leaves the URL alone without an outcome", () => {
		const replaceState = vi.fn();
		captureWebLinkOutcome(
			{ href: "https://colibri.social/app/settings" },
			{ state: null, replaceState },
		);
		expect(replaceState).not.toHaveBeenCalled();
	});

	it("explains a guest profile", () => {
		expect(linkErrorMessage("GuestAccount")).toContain("guest profile");
		expect(linkErrorMessage("Whatever")).toBe(
			"Linking your Open Collective account didn't work. Try again.",
		);
	});
});

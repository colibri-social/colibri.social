import { afterEach, describe, expect, it, vi } from "vitest";
import {
	cachedAccounts,
	cachedPrefixAccounts,
	clearAccountSearchCache,
	resolvePdsHost,
	searchAccounts,
} from "./identity";

const TYPEAHEAD =
	"https://typeahead.waow.tech/xrpc/app.bsky.actor.searchActorsTypeahead";

const actors = {
	lo: [
		{ did: "did:plc:lou", handle: "lou.gg", displayName: "Lou" },
		{ did: "did:plc:lola", handle: "lola.bsky.social", displayName: "Lola" },
		{ did: "did:plc:bot", handle: "bot.lou.gg" },
	],
};

const typeahead = () =>
	vi.fn(async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		if (`${url.origin}${url.pathname}` !== TYPEAHEAD) {
			return new Response("unexpected", { status: 500 });
		}
		const q = url.searchParams.get("q") ?? "";
		return Response.json({ actors: actors[q as keyof typeof actors] ?? [] });
	});

afterEach(() => {
	vi.unstubAllGlobals();
	clearAccountSearchCache();
});

describe("account search cache", () => {
	it("answers a repeated query from the session cache", async () => {
		const fetchMock = typeahead();
		vi.stubGlobal("fetch", fetchMock);
		const first = await searchAccounts("lo");
		const second = await searchAccounts("@LO ");
		expect(second).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(cachedAccounts("lo")?.map((account) => account.did)).toEqual([
			"did:plc:lou",
			"did:plc:lola",
			"did:plc:bot",
		]);
	});

	it("filters a cached shorter query for a longer prefix", async () => {
		vi.stubGlobal("fetch", typeahead());
		await searchAccounts("lo");
		expect(
			cachedPrefixAccounts("lou")?.map((account) => account.handle),
		).toEqual(["lou.gg", "bot.lou.gg"]);
		expect(cachedPrefixAccounts("x")).toBeUndefined();
	});

	it("never caches an aborted or failed query", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new DOMException("aborted", "AbortError");
			}),
		);
		expect(await searchAccounts("lo")).toEqual([]);
		expect(cachedAccounts("lo")).toBeUndefined();
	});
});

describe("resolvePdsHost", () => {
	it("reads the account's server from the DID document", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) =>
				String(input) === "https://plc.directory/did:plc:lou"
					? Response.json({
							service: [
								{
									id: "#atproto_pds",
									type: "AtprotoPersonalDataServer",
									serviceEndpoint: "https://pds.example.com",
								},
							],
						})
					: new Response("", { status: 404 }),
			),
		);
		expect(await resolvePdsHost("did:plc:lou")).toBe("pds.example.com");
		expect(await resolvePdsHost("did:plc:other")).toBeUndefined();
		expect(await resolvePdsHost("did:key:abc")).toBeUndefined();
	});
});

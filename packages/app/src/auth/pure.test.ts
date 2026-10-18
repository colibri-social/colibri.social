import { afterEach, describe, expect, it, vi } from "vitest";
import { appViewHost, appViewServiceRef } from "./appview";
import { callbackParamsFrom, nativeCallbackParams } from "./callback";
import { makeClientId, NATIVE_CLIENT_ORIGIN } from "./client-id";
import { createOAuthFetch } from "./fetch";
import {
	clearAccountSearchCache,
	handleResolver,
	resolveHandleToDid,
	searchAccounts,
} from "./identity";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	clearAccountSearchCache();
});

const location = (host: string, port = "") => ({
	hostname: host.split(":")[0] ?? host,
	host,
	port,
});

describe("appview", () => {
	it("derives the service reference and hosts", () => {
		expect(appViewServiceRef("https://spaces-api.colibri.social")).toBe(
			"did:web:spaces-api.colibri.social#colibri_appview",
		);
		expect(appViewHost("ws", "https://spaces-api.colibri.social")).toBe(
			"wss://spaces-api.colibri.social",
		);
		expect(appViewHost("ws", "http://127.0.0.1:3000")).toBe(
			"ws://127.0.0.1:3000",
		);
	});
});

describe("client id", () => {
	it("points native builds at the public metadata", () => {
		expect(
			makeClientId({
				native: true,
				location: location("tauri.localhost"),
				appView: "https://spaces-api.colibri.social",
			}),
		).toBe(`${NATIVE_CLIENT_ORIGIN}/oauth-client-metadata-native.json`);
		expect(
			makeClientId({
				native: true,
				location: location("tauri.localhost"),
				appView: "https://other.example",
			}),
		).toBe(
			`${NATIVE_CLIENT_ORIGIN}/c/other.example/oauth-client-metadata-native.json`,
		);
	});

	it("uses a loopback client in local development", () => {
		const id = new URL(
			makeClientId({
				native: false,
				location: location("127.0.0.1:5173", "5173"),
				appView: "https://spaces-api.colibri.social",
			}),
		);
		expect(id.origin).toBe("http://localhost");
		expect(id.searchParams.get("redirect_uri")).toBe(
			"http://127.0.0.1:5173/app/login",
		);
		expect(id.searchParams.get("scope")).toContain(
			"aud=did:web:spaces-api.colibri.social#colibri_appview",
		);
	});

	it("uses the page origin on the web", () => {
		expect(
			makeClientId({
				native: false,
				location: location("colibri.social"),
				appView: "https://spaces-api.colibri.social",
			}),
		).toBe("https://colibri.social/oauth-client-metadata.json");
	});
});

describe("callback params", () => {
	it("reads success and failure from the hash or query", () => {
		expect(
			callbackParamsFrom({ hash: "#state=s&code=c", search: "" })?.get("code"),
		).toBe("c");
		expect(
			callbackParamsFrom({
				hash: "",
				search: "?state=s&error=access_denied",
			})?.get("error"),
		).toBe("access_denied");
		expect(
			callbackParamsFrom({ hash: "#members", search: "" }),
		).toBeUndefined();
		expect(callbackParamsFrom({ hash: "", search: "?code=c" })).toBeUndefined();
	});

	it("reads native deep links", () => {
		expect(
			nativeCallbackParams(
				"social.colibri:/oauth/callback?state=s&code=c",
			)?.get("state"),
		).toBe("s");
		expect(
			nativeCallbackParams("social.colibri:/app/invite/abc"),
		).toBeUndefined();
		expect(nativeCallbackParams("not a url")).toBeUndefined();
	});
});

describe("handle resolution", () => {
	const stub = (routes: {
		appView?: () => Response | Promise<Response>;
		wellKnown?: () => Response | Promise<Response>;
	}) => {
		const fetchMock = vi.fn(async (input: string) => {
			if (input.includes("com.atproto.identity.resolveHandle")) {
				return routes.appView?.() ?? new Response("", { status: 500 });
			}
			if (input.includes("/.well-known/atproto-did")) {
				return routes.wellKnown?.() ?? new Response("", { status: 404 });
			}
			return new Response("", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	};

	it("prefers the AppView answer", async () => {
		stub({
			appView: () => Response.json({ did: "did:plc:appview" }),
			wellKnown: () => new Response("did:plc:wellknown"),
		});
		expect(await resolveHandleToDid("@Alice.Example ")).toBe("did:plc:appview");
	});

	it("falls back to the well-known record", async () => {
		const fetchMock = stub({
			appView: () =>
				Response.json({ error: "InvalidRequest" }, { status: 400 }),
			wellKnown: () => new Response("did:plc:ewvi7nxzyoun6zhxrhs64oiz\n"),
		});
		expect(await handleResolver.resolve("alice.example", {})).toBe(
			"did:plc:ewvi7nxzyoun6zhxrhs64oiz",
		);
		const urls = fetchMock.mock.calls.map(([url]) => url);
		expect(urls).toContain("https://alice.example/.well-known/atproto-did");
	});

	it("reports a username nobody has", async () => {
		stub({
			appView: () =>
				Response.json({ error: "InvalidRequest" }, { status: 400 }),
		});
		await expect(resolveHandleToDid("nobody.example")).rejects.toMatchObject({
			code: "HandleNotFound",
		});
	});

	it("passes a DID through untouched", async () => {
		const fetchMock = stub({});
		expect(await resolveHandleToDid("did:plc:abc")).toBe("did:plc:abc");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("suggests accounts and stays empty on failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({
					actors: [{ did: "did:plc:a", handle: "a.example", displayName: "" }],
				}),
			),
		);
		expect(await searchAccounts("a")).toEqual([
			{
				did: "did:plc:a",
				handle: "a.example",
				displayName: undefined,
				avatar: undefined,
			},
		]);
		clearAccountSearchCache();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("offline");
			}),
		);
		expect(await searchAccounts("a")).toEqual([]);
		expect(await searchAccounts("  ")).toEqual([]);
	});
});

describe("oauth fetch", () => {
	it("retries a failed read once, then reports the host as unreachable", async () => {
		vi.useFakeTimers();
		const base = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		const pending = createOAuthFetch(base)("https://pds.example/.well-known/x");
		const result = expect(pending).rejects.toMatchObject({
			code: "Unreachable",
			context: { host: "pds.example" },
		});
		await vi.runAllTimersAsync();
		await result;
		expect(base).toHaveBeenCalledTimes(2);
	});

	it("never repeats a write", async () => {
		const base = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		await expect(
			createOAuthFetch(base)("https://pds.example/oauth/token", {
				method: "POST",
				body: "x",
			}),
		).rejects.toMatchObject({ code: "Unreachable" });
		expect(base).toHaveBeenCalledTimes(1);
	});
});

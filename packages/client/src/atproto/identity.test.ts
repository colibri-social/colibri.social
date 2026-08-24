import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isColibriError } from "../errors/error";
import { getAppViewHost } from "../utils/appview";
import {
	handleResolver,
	peekCachedPdsForDid,
	resolveDidDocument,
	resolveHandleToDid,
	resolvePdsForDid,
} from "./identity";

const VALID_DID = "did:plc:abcdefghijklmnopqrstuvwx";
const OTHER_VALID_DID = "did:plc:zyxwvutsrqponmlkjihgfedc";

const createLocalStorage = () => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) =>
			store.has(key) ? (store.get(key) as string) : null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
	};
};

let fetchMock: ReturnType<typeof vi.fn>;
let storage: ReturnType<typeof createLocalStorage>;

const contextOf = async (
	promise: Promise<unknown>,
): Promise<Record<string, unknown>> => {
	try {
		await promise;
	} catch (err) {
		return isColibriError(err) ? err.context : { unexpected: String(err) };
	}
	return { unexpected: "resolved" };
};

const codeOf = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
	} catch (err) {
		return isColibriError(err) ? err.code : `unexpected:${String(err)}`;
	}
	return "resolved";
};

const textResponse = (status: number, body: string) => ({
	ok: status >= 200 && status < 300,
	status,
	text: () => Promise.resolve(body),
	json: () => Promise.resolve(body === "" ? {} : JSON.parse(body)),
	headers: { get: () => null },
});

const jsonResponse = (status: number, body: unknown) => ({
	ok: status >= 200 && status < 300,
	status,
	text: () => Promise.resolve(JSON.stringify(body)),
	json: () => Promise.resolve(body),
	headers: { get: () => null },
});

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	storage = createLocalStorage();
	vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const WELL_KNOWN_URL = (handle: string) =>
	`https://${handle}/.well-known/atproto-did`;

const isAppViewCall = (url: string) =>
	url.startsWith(`${getAppViewHost("http")}/xrpc/`);

const callTo = (predicate: (url: string) => boolean) =>
	fetchMock.mock.calls.find((call) => predicate(String(call[0])));

const routeByUrl = (
	routes: Partial<{ wellKnown: unknown; appView: unknown }>,
) => {
	fetchMock.mockImplementation((input: string) => {
		const url = String(input);
		const route = isAppViewCall(url) ? routes.appView : routes.wellKnown;
		if (route === undefined) return Promise.reject(new TypeError("no route"));
		return route instanceof Error
			? Promise.reject(route)
			: Promise.resolve(route);
	});
};

describe("resolveHandleToDid", () => {
	it("passes a did straight through without a request", async () => {
		await expect(resolveHandleToDid(VALID_DID)).resolves.toBe(VALID_DID);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("prefers the appview's did over the well-known endpoint's", async () => {
		routeByUrl({
			wellKnown: textResponse(200, VALID_DID),
			appView: jsonResponse(200, { did: OTHER_VALID_DID }),
		});

		await expect(resolveHandleToDid("alice.example.com")).resolves.toBe(
			OTHER_VALID_DID,
		);

		const call = callTo(isAppViewCall);
		const url = new URL(String(call?.[0]));
		expect(url.pathname).toBe("/xrpc/com.atproto.identity.resolveHandle");
		expect(url.searchParams.get("handle")).toBe("alice.example.com");
	});

	it("asks both sources at once rather than waiting on the well-known endpoint", async () => {
		routeByUrl({
			wellKnown: textResponse(404, ""),
			appView: jsonResponse(200, { did: OTHER_VALID_DID }),
		});

		await resolveHandleToDid("bob.example.com");

		expect(
			callTo((url) => url === WELL_KNOWN_URL("bob.example.com")),
		).toBeDefined();
		expect(callTo(isAppViewCall)).toBeDefined();
	});

	it("falls back to the well-known endpoint when the appview reports InvalidRequest", async () => {
		routeByUrl({
			wellKnown: textResponse(200, VALID_DID),
			appView: jsonResponse(400, {
				error: "InvalidRequest",
				message: "Unable to resolve handle",
			}),
		});

		await expect(resolveHandleToDid("carol.example.com")).resolves.toBe(
			VALID_DID,
		);
	});

	it("falls back to the well-known endpoint when the appview is broken", async () => {
		routeByUrl({
			wellKnown: textResponse(200, VALID_DID),
			appView: jsonResponse(500, { error: "InternalError", message: "boom" }),
		});

		await expect(resolveHandleToDid("dana.example.com")).resolves.toBe(
			VALID_DID,
		);
	});

	it("treats a well-known network failure as a miss", async () => {
		routeByUrl({
			wellKnown: new TypeError("Failed to fetch"),
			appView: jsonResponse(200, { did: OTHER_VALID_DID }),
		});

		await expect(resolveHandleToDid("erin.example.com")).resolves.toBe(
			OTHER_VALID_DID,
		);
	});

	it("treats a well-known body that isn't a did as a miss", async () => {
		routeByUrl({
			wellKnown: textResponse(200, "not a did"),
			appView: jsonResponse(400, {
				error: "InvalidRequest",
				message: "Unable to resolve handle",
			}),
		});

		await expect(codeOf(resolveHandleToDid("frank.example.com"))).resolves.toBe(
			"HandleNotFound",
		);
	});

	it("throws HandleNotFound with a trail when both sources miss", async () => {
		routeByUrl({
			wellKnown: textResponse(404, ""),
			appView: jsonResponse(400, {
				error: "InvalidRequest",
				message: "Unable to resolve handle",
			}),
		});

		await expect(
			contextOf(resolveHandleToDid("nope.example.com")),
		).resolves.toMatchObject({
			handle: "nope.example.com",
			resolveTrail: "appview:miss well-known:miss",
		});
	});

	it("surfaces the appview failure when the well-known endpoint also misses", async () => {
		routeByUrl({
			wellKnown: textResponse(404, ""),
			appView: jsonResponse(500, { error: "InternalError", message: "boom" }),
		});

		await expect(codeOf(resolveHandleToDid("gina.example.com"))).resolves.toBe(
			"UpstreamFailure",
		);
	});
});

describe("handleResolver", () => {
	it("resolves a handle for BrowserOAuthClient", async () => {
		routeByUrl({
			wellKnown: textResponse(404, ""),
			appView: jsonResponse(200, { did: VALID_DID }),
		});

		await expect(handleResolver.resolve("alice.example.com")).resolves.toBe(
			VALID_DID,
		);
	});

	it("returns null, not a throw, when the handle doesn't exist", async () => {
		routeByUrl({
			wellKnown: textResponse(404, ""),
			appView: jsonResponse(400, {
				error: "InvalidRequest",
				message: "bad handle",
			}),
		});

		await expect(
			handleResolver.resolve("nope.example.com"),
		).resolves.toBeNull();
	});
});

describe("resolveDidDocument", () => {
	it("resolves a did:plc document from the plc directory", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { service: [] }));

		await resolveDidDocument(VALID_DID);

		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`https://plc.directory/${VALID_DID}`,
		);
	});

	it("resolves a did:web document, decoding the %3A port separator", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(200, { service: [] }));

		await resolveDidDocument("did:web:example.com%3A8080");

		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://example.com:8080/.well-known/did.json",
		);
	});

	it("returns undefined for an unsupported did method", async () => {
		await expect(resolveDidDocument("did:key:abc")).resolves.toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("resolvePdsForDid", () => {
	it("extracts the #atproto_pds service endpoint's host", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, {
				service: [
					{
						id: "#atproto_pds",
						type: "AtprotoPersonalDataServer",
						serviceEndpoint: "https://pds.example",
					},
				],
			}),
		);

		await expect(resolvePdsForDid(VALID_DID)).resolves.toBe("pds.example");
	});

	it("caches the resolved host under colibri:pds:<did>", async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse(200, {
				service: [
					{ id: "#atproto_pds", serviceEndpoint: "https://pds.example" },
				],
			}),
		);

		await resolvePdsForDid(VALID_DID);

		expect(peekCachedPdsForDid(VALID_DID)).toBe("pds.example");
		expect(storage.getItem(`colibri:pds:${VALID_DID}`)).toBe("pds.example");
	});
});

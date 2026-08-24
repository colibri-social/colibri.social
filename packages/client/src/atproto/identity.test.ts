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

describe("resolveHandleToDid", () => {
	it("passes a did straight through without a request", async () => {
		await expect(resolveHandleToDid(VALID_DID)).resolves.toBe(VALID_DID);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("resolves via the handle's own well-known endpoint", async () => {
		fetchMock.mockResolvedValueOnce(textResponse(200, VALID_DID));

		await expect(resolveHandleToDid("alice.example.com")).resolves.toBe(
			VALID_DID,
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://alice.example.com/.well-known/atproto-did",
		);
	});

	it("falls through to the appview when the well-known endpoint 404s", async () => {
		fetchMock
			.mockResolvedValueOnce(textResponse(404, ""))
			.mockResolvedValueOnce(jsonResponse(200, { did: OTHER_VALID_DID }));

		await expect(resolveHandleToDid("bob.example.com")).resolves.toBe(
			OTHER_VALID_DID,
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		const call = new URL(fetchMock.mock.calls[1]?.[0] as string);
		expect(call.origin).toBe(getAppViewHost("http"));
		expect(call.pathname).toBe("/xrpc/com.atproto.identity.resolveHandle");
		expect(call.searchParams.get("handle")).toBe("bob.example.com");
	});

	it("treats a well-known network failure as a miss and falls through to the appview", async () => {
		fetchMock
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(jsonResponse(200, { did: OTHER_VALID_DID }));

		await expect(resolveHandleToDid("carol.example.com")).resolves.toBe(
			OTHER_VALID_DID,
		);
	});

	it("treats a well-known body that isn't a did as a miss", async () => {
		fetchMock
			.mockResolvedValueOnce(textResponse(200, "not a did"))
			.mockResolvedValueOnce(jsonResponse(200, { did: OTHER_VALID_DID }));

		await expect(resolveHandleToDid("dana.example.com")).resolves.toBe(
			OTHER_VALID_DID,
		);
	});

	it("throws HandleNotFound when the appview reports InvalidRequest, without a further attempt", async () => {
		fetchMock
			.mockResolvedValueOnce(textResponse(404, ""))
			.mockResolvedValueOnce(
				jsonResponse(400, {
					error: "InvalidRequest",
					message: "Unable to resolve handle",
				}),
			);

		await expect(codeOf(resolveHandleToDid("nope.example.com"))).resolves.toBe(
			"HandleNotFound",
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("throws a reportable failure when the appview is broken", async () => {
		fetchMock
			.mockResolvedValueOnce(textResponse(404, ""))
			.mockResolvedValueOnce(
				jsonResponse(500, { error: "InternalError", message: "boom" }),
			);

		await expect(codeOf(resolveHandleToDid("erin.example.com"))).resolves.toBe(
			"UpstreamFailure",
		);
	});
});

describe("handleResolver", () => {
	it("resolves a handle for BrowserOAuthClient", async () => {
		fetchMock.mockResolvedValueOnce(textResponse(200, VALID_DID));

		await expect(handleResolver.resolve("alice.example.com")).resolves.toBe(
			VALID_DID,
		);
	});

	it("returns null, not a throw, when the handle doesn't exist", async () => {
		fetchMock
			.mockResolvedValueOnce(textResponse(404, ""))
			.mockResolvedValueOnce(jsonResponse(200, { pds: "https://pds.example" }))
			.mockResolvedValueOnce(
				jsonResponse(400, { error: "InvalidRequest", message: "bad handle" }),
			);

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

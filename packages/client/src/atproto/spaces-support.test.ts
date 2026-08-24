import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSpacesSupportCache, supportsSpaces } from "./spaces-support";

const SPACES_HOST = "spaces-alpha.host.bsky.network";
const STOCK_HOST = "bsky.social";

const jsonResponse = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const errorResponse = (status: number, error: string): Response =>
	jsonResponse(status, { error, message: "nope" });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	clearSpacesSupportCache();
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("supportsSpaces", () => {
	it("accepts a host that rejects the probe's space reference", async () => {
		fetchMock.mockResolvedValue(errorResponse(400, "InvalidRequest"));
		await expect(supportsSpaces(SPACES_HOST)).resolves.toBe(true);
	});

	it("rejects a host that treats the method as unknown", async () => {
		fetchMock.mockResolvedValue(errorResponse(401, "AuthMissing"));
		await expect(supportsSpaces(STOCK_HOST)).resolves.toBe(false);
	});

	it("rejects a host that answers 404 or 501", async () => {
		fetchMock.mockResolvedValue(new Response("", { status: 404 }));
		await expect(supportsSpaces(STOCK_HOST)).resolves.toBe(false);

		clearSpacesSupportCache();
		fetchMock.mockResolvedValue(new Response("", { status: 501 }));
		await expect(supportsSpaces(STOCK_HOST)).resolves.toBe(false);
	});

	it("rejects a host that names the method unimplemented", async () => {
		fetchMock.mockResolvedValue(errorResponse(400, "MethodNotImplemented"));
		await expect(supportsSpaces(STOCK_HOST)).resolves.toBe(false);
	});

	it("stays undecided when the host is unreachable", async () => {
		fetchMock.mockRejectedValue(new TypeError("network"));
		await expect(supportsSpaces(SPACES_HOST)).resolves.toBeUndefined();
	});

	it("stays undecided on a server error", async () => {
		fetchMock.mockResolvedValue(new Response("", { status: 502 }));
		await expect(supportsSpaces(SPACES_HOST)).resolves.toBeUndefined();
	});

	it("stays undecided on an unfamiliar error name", async () => {
		fetchMock.mockResolvedValue(errorResponse(400, "SomethingNewEntirely"));
		await expect(supportsSpaces(SPACES_HOST)).resolves.toBeUndefined();
	});

	it("stays undecided when the body carries no error name", async () => {
		fetchMock.mockResolvedValue(new Response("not json", { status: 400 }));
		await expect(supportsSpaces(SPACES_HOST)).resolves.toBeUndefined();
	});

	it("probes over https for a public host and http for loopback", async () => {
		fetchMock.mockResolvedValue(errorResponse(400, "InvalidRequest"));

		await supportsSpaces(SPACES_HOST);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`https://${SPACES_HOST}/xrpc/com.atproto.space.getDelegationToken?space=colibri-spaces-probe`,
		);

		clearSpacesSupportCache();
		await supportsSpaces("127.0.0.1:3001");
		expect(fetchMock.mock.calls[1]?.[0]).toBe(
			"http://127.0.0.1:3001/xrpc/com.atproto.space.getDelegationToken?space=colibri-spaces-probe",
		);

		clearSpacesSupportCache();
		await supportsSpaces("localhost:3001");
		expect(fetchMock.mock.calls[2]?.[0]).toBe(
			"http://localhost:3001/xrpc/com.atproto.space.getDelegationToken?space=colibri-spaces-probe",
		);
	});

	it("caches a decided answer and re-probes an undecided one", async () => {
		fetchMock.mockResolvedValue(errorResponse(401, "AuthMissing"));
		await supportsSpaces(STOCK_HOST);
		await supportsSpaces(STOCK_HOST);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		clearSpacesSupportCache();
		fetchMock.mockRejectedValue(new TypeError("network"));
		await supportsSpaces(STOCK_HOST);
		await supportsSpaces(STOCK_HOST);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("keeps one host's answer from deciding another's", async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(401, "AuthMissing"));
		fetchMock.mockResolvedValueOnce(errorResponse(400, "InvalidRequest"));

		await expect(supportsSpaces(STOCK_HOST)).resolves.toBe(false);
		await expect(supportsSpaces(SPACES_HOST)).resolves.toBe(true);
	});
});

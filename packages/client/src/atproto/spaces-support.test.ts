import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSpacesSupportCache, supportsSpaces } from "./spaces-support";

const HOST = "pds.example.com";

const DESCRIBE = "community.lexicon.service.describe";
const PROBE = "com.atproto.space.getDelegationToken";
const CONTROL = "com.atproto.space.colibriProbeControl";

type Answer = () => Response | Promise<Response>;

const jsonResponse = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const errorResponse = (status: number, error: string, message = "nope") =>
	jsonResponse(status, { error, message });

const describeResponse = (methods: string[]) =>
	jsonResponse(200, {
		roles: ["pds"],
		methods: methods.map((value) => ({
			$type: `${DESCRIBE}#nsid`,
			value,
		})),
	});

const authMissing = () =>
	errorResponse(401, "AuthMissing", "Authentication Required");

let fetchMock: ReturnType<typeof vi.fn>;

const route = (answers: Record<string, Answer>) => {
	fetchMock.mockImplementation(async (url: string) => {
		const method = new URL(url).pathname.replace("/xrpc/", "");
		const answer = answers[method];
		if (!answer) throw new Error(`unexpected request to ${url}`);
		return answer();
	});
};

const calledMethods = (): string[] =>
	fetchMock.mock.calls.map(([url]) =>
		new URL(url as string).pathname.replace("/xrpc/", ""),
	);

beforeEach(() => {
	clearSpacesSupportCache();
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("supportsSpaces", () => {
	it("trusts a service description that lists the delegation method", async () => {
		route({ [DESCRIBE]: () => describeResponse([DESCRIBE, PROBE]) });

		await expect(supportsSpaces(HOST)).resolves.toBe(true);
		expect(calledMethods()).toEqual([DESCRIBE]);
	});

	it("trusts a service description that leaves the delegation method out", async () => {
		route({
			[DESCRIBE]: () =>
				describeResponse([DESCRIBE, "com.atproto.repo.getRecord"]),
		});

		await expect(supportsSpaces(HOST)).resolves.toBe(false);
		expect(calledMethods()).toEqual([DESCRIBE]);
	});

	it("falls through to the probe when the description is unusable", async () => {
		for (const answer of [
			authMissing,
			() => errorResponse(400, "InvalidRequest"),
			() => new Response("", { status: 404 }),
			() => jsonResponse(200, { roles: ["pds"] }),
			() => new Response("not json", { status: 200 }),
		]) {
			clearSpacesSupportCache();
			fetchMock.mockReset();
			route({
				[DESCRIBE]: answer,
				[PROBE]: () =>
					errorResponse(400, "InvalidRequest", `Invalid ${PROBE} params`),
				[CONTROL]: authMissing,
			});

			await expect(supportsSpaces(HOST)).resolves.toBe(true);
			expect(calledMethods()).toContain(PROBE);
		}
	});

	it("accepts the reference pds, which validates params before auth", async () => {
		route({
			[DESCRIBE]: authMissing,
			[PROBE]: () =>
				errorResponse(
					400,
					"InvalidRequest",
					`Invalid ${PROBE} params: Invalid space-ref (got "colibri-spaces-probe")`,
				),
			[CONTROL]: authMissing,
		});

		await expect(supportsSpaces(HOST)).resolves.toBe(true);
	});

	it("accepts a pds that checks auth before params", async () => {
		route({
			[DESCRIBE]: () => new Response("", { status: 404 }),
			[PROBE]: authMissing,
			[CONTROL]: () => errorResponse(501, "MethodNotImplemented"),
		});

		await expect(supportsSpaces(HOST)).resolves.toBe(true);
	});

	it("accepts a pds that rejects the probe's space reference", async () => {
		route({
			[DESCRIBE]: authMissing,
			[PROBE]: () => errorResponse(400, "InvalidSpaceRef"),
			[CONTROL]: () => errorResponse(400, "InvalidSpaceRef"),
		});

		await expect(supportsSpaces(HOST)).resolves.toBe(true);
	});

	it("rejects a pds that answers the probe the same as a missing method", async () => {
		for (const answer of [
			authMissing,
			() => errorResponse(501, "MethodNotImplemented"),
			() => new Response("", { status: 404 }),
			() => new Response("", { status: 418 }),
			() => errorResponse(400, "InvalidRequest", "Invalid request"),
		]) {
			clearSpacesSupportCache();
			route({ [DESCRIBE]: answer, [PROBE]: answer, [CONTROL]: answer });

			await expect(supportsSpaces(HOST)).resolves.toBe(false);
		}
	});

	it("stays undecided when the host is unreachable", async () => {
		fetchMock.mockRejectedValue(new TypeError("network"));
		await expect(supportsSpaces(HOST)).resolves.toBeUndefined();
	});

	it("stays undecided when either probe hits a server error", async () => {
		route({
			[DESCRIBE]: authMissing,
			[PROBE]: () => new Response("", { status: 502 }),
			[CONTROL]: authMissing,
		});
		await expect(supportsSpaces(HOST)).resolves.toBeUndefined();

		route({
			[DESCRIBE]: authMissing,
			[PROBE]: authMissing,
			[CONTROL]: () => new Response("", { status: 503 }),
		});
		await expect(supportsSpaces(HOST)).resolves.toBeUndefined();
	});

	it("probes over https for a public host and http for loopback", async () => {
		route({
			[DESCRIBE]: () => describeResponse([PROBE]),
			[PROBE]: authMissing,
			[CONTROL]: authMissing,
		});

		await supportsSpaces(HOST);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`https://${HOST}/xrpc/${DESCRIBE}`,
		);

		for (const loopback of ["127.0.0.1:3001", "localhost:3001"]) {
			fetchMock.mockClear();
			await supportsSpaces(loopback);
			expect(fetchMock.mock.calls[0]?.[0]).toBe(
				`http://${loopback}/xrpc/${DESCRIBE}`,
			);
		}
	});

	it("sends the probe space to both probe methods", async () => {
		route({
			[DESCRIBE]: authMissing,
			[PROBE]: authMissing,
			[CONTROL]: authMissing,
		});

		await supportsSpaces(HOST);
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
			expect.arrayContaining([
				`https://${HOST}/xrpc/${PROBE}?space=colibri-spaces-probe`,
				`https://${HOST}/xrpc/${CONTROL}?space=colibri-spaces-probe`,
			]),
		);
	});

	it("caches a decided answer and re-probes an undecided one", async () => {
		route({
			[DESCRIBE]: authMissing,
			[PROBE]: authMissing,
			[CONTROL]: authMissing,
		});
		await supportsSpaces(HOST);
		await supportsSpaces(HOST);
		expect(fetchMock).toHaveBeenCalledTimes(3);

		clearSpacesSupportCache();
		fetchMock.mockReset();
		fetchMock.mockRejectedValue(new TypeError("network"));
		await supportsSpaces(HOST);
		await supportsSpaces(HOST);
		expect(fetchMock).toHaveBeenCalledTimes(6);
	});

	it("keeps one host's answer from deciding another's", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			const { host, pathname } = new URL(url);
			if (host === "spaces.example.com" && pathname.endsWith(DESCRIBE)) {
				return describeResponse([PROBE]);
			}
			return authMissing();
		});

		await expect(supportsSpaces("stock.example.com")).resolves.toBe(false);
		await expect(supportsSpaces("spaces.example.com")).resolves.toBe(true);
	});
});

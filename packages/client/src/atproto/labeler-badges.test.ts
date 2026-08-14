import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LABELER_DID } from "../utils/labeler";

const PDS = "pds.example";
const FAILURE_TTL_MS = 30_000;
const DEFINITIONS_TTL_MS = 60 * 60 * 1000;

const ok = (body: unknown) => ({
	ok: true,
	status: 200,
	headers: { get: () => null },
	json: () => Promise.resolve(body),
	text: () => Promise.resolve(""),
});

const didDocument = () =>
	ok({
		service: [
			{
				id: "#atproto_pds",
				type: "AtprotoPersonalDataServer",
				serviceEndpoint: `https://${PDS}`,
			},
		],
	});

const solid = (identifier: string, precedence: number) => ({
	identifier,
	name: identifier.toUpperCase(),
	description: `the ${identifier} badge`,
	precedence,
	appearance: {
		variant: "solid",
		colors: ["#8b5cf6"],
		foreground: "#fafafa",
	},
});

const record = (badgeDefinitions: Array<unknown>) =>
	ok({
		uri: `at://${DEFAULT_LABELER_DID}/social.colibri.labeler.service/self`,
		value: { badgeDefinitions, createdAt: "2026-01-01T00:00:00.000Z" },
	});

let fetchMock: ReturnType<typeof vi.fn>;

const load = async () => {
	vi.resetModules();
	return await import("./labeler-badges");
};

const serve = (...pages: Array<unknown>) => {
	fetchMock.mockResolvedValueOnce(didDocument());
	for (const page of pages) fetchMock.mockResolvedValueOnce(page);
};

beforeEach(() => {
	vi.useFakeTimers();
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("getLabelerBadgeDefinitions", () => {
	it("reads the service record from the labeler's own PDS", async () => {
		serve(record([solid("team", 0)]));
		const { getLabelerBadgeDefinitions } = await load();

		const definitions = await getLabelerBadgeDefinitions();

		expect(definitions).toHaveLength(1);
		expect(definitions[0]).toEqual(solid("team", 0));

		const url = new URL(fetchMock.mock.calls[1]?.[0] as string);
		expect(url.origin).toBe(`https://${PDS}`);
		expect(url.pathname).toBe("/xrpc/com.atproto.repo.getRecord");
		expect(url.searchParams.get("repo")).toBe(DEFAULT_LABELER_DID);
		expect(url.searchParams.get("collection")).toBe(
			"social.colibri.labeler.service",
		);
		expect(url.searchParams.get("rkey")).toBe("self");
	});

	it("keeps a badge whose appearance is unusable, without the appearance", async () => {
		serve(
			record([
				{ ...solid("team", 0), appearance: { variant: "solid" } },
				{
					...solid("donator", 1),
					appearance: {
						variant: "solid",
						colors: ["red"],
						foreground: "#ffffff",
					},
				},
				{
					...solid("bespoke", 2),
					appearance: {
						variant: "neon",
						colors: ["#8b5cf6"],
						foreground: "#ffffff",
					},
				},
			]),
		);
		const { getLabelerBadgeDefinitions } = await load();

		const definitions = await getLabelerBadgeDefinitions();

		expect(definitions.map((d) => d.identifier)).toEqual([
			"team",
			"donator",
			"bespoke",
		]);
		for (const definition of definitions) {
			expect(definition.appearance).toBeUndefined();
		}
	});

	it("rejects a colour that is not a hex literal so the record cannot inject CSS", async () => {
		serve(
			record([
				{
					...solid("team", 0),
					appearance: {
						variant: "solid",
						colors: ["#8b5cf6; background-image: url(x)"],
						foreground: "#ffffff",
					},
				},
			]),
		);
		const { getLabelerBadgeDefinitions } = await load();

		expect((await getLabelerBadgeDefinitions())[0]?.appearance).toBeUndefined();
	});

	it("drops an entry that is missing a required field", async () => {
		serve(
			record([
				solid("team", 0),
				{ identifier: "nameless", description: "no name" },
				{ name: "NO IDENTIFIER", description: "" },
				"not-an-object",
			]),
		);
		const { getLabelerBadgeDefinitions } = await load();

		expect(
			(await getLabelerBadgeDefinitions()).map((d) => d.identifier),
		).toEqual(["team"]);
	});

	it("accepts eight-digit hex and omits an absent precedence", async () => {
		serve(
			record([
				{
					identifier: "team",
					name: "TEAM",
					description: "",
					appearance: {
						colors: ["#8b5cf6cc"],
						foreground: "#fafafaff",
					},
				},
			]),
		);
		const { getLabelerBadgeDefinitions } = await load();

		const [definition] = await getLabelerBadgeDefinitions();
		expect(definition.precedence).toBeUndefined();
		expect(definition.appearance).toEqual({
			variant: "solid",
			colors: ["#8b5cf6cc"],
			foreground: "#fafafaff",
		});
	});

	it("returns nothing when the record does not exist, leaving the caller's bundled badges in place", async () => {
		fetchMock.mockResolvedValueOnce(didDocument());
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 400,
			headers: { get: () => null },
			json: () => Promise.resolve({}),
			text: () => Promise.resolve('{"error":"RecordNotFound"}'),
		});
		const { getLabelerBadgeDefinitions } = await load();

		expect(await getLabelerBadgeDefinitions()).toEqual([]);
	});

	it("returns nothing when the labeler DID has no resolvable PDS", async () => {
		fetchMock.mockResolvedValueOnce(ok({ service: [] }));
		const { getLabelerBadgeDefinitions } = await load();

		expect(await getLabelerBadgeDefinitions()).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("serves a warm catalogue from memory without a request", async () => {
		serve(record([solid("team", 0)]));
		const { getLabelerBadgeDefinitions } = await load();

		const first = await getLabelerBadgeDefinitions();
		expect(fetchMock).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(DEFINITIONS_TTL_MS / 2);
		expect(await getLabelerBadgeDefinitions()).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("degrades to nothing on failure and retries only after the failure TTL", async () => {
		fetchMock.mockRejectedValue(new Error("boom"));
		const { getLabelerBadgeDefinitions } = await load();

		expect(await getLabelerBadgeDefinitions()).toEqual([]);
		const afterFirst = fetchMock.mock.calls.length;

		await vi.advanceTimersByTimeAsync(FAILURE_TTL_MS / 2);
		expect(await getLabelerBadgeDefinitions()).toEqual([]);
		expect(fetchMock.mock.calls.length).toBe(afterFirst);

		await vi.advanceTimersByTimeAsync(FAILURE_TTL_MS);
		expect(await getLabelerBadgeDefinitions()).toEqual([]);
		expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirst);
	});

	it("coalesces concurrent callers into one round trip", async () => {
		serve(record([solid("team", 0)]));
		const { getLabelerBadgeDefinitions } = await load();

		const [a, b, c] = await Promise.all([
			getLabelerBadgeDefinitions(),
			getLabelerBadgeDefinitions(),
			getLabelerBadgeDefinitions(),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(a).toBe(b);
		expect(b).toBe(c);
	});
});

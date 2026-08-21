import { beforeEach, describe, expect, it } from "vitest";
import type { Member } from "../atproto/xrpc/social/colibri/community/listMembers";
import { createMemberIndex } from "./member-search";
import { forgetSpeakers, recordSpeaker, speakerRanks } from "./recent-speakers";

const COMMUNITY = "at://did:plc:one/social.colibri.community/self";

const member = (did: string, displayName: string, handle: string): Member =>
	({
		did,
		handle,
		roles: [],
		data: {
			displayName,
			isBot: false,
			onlineState: "online",
		},
	}) as unknown as Member;

const JOSE = member("did:plc:jose", "José Álvarez", "jose.example.com");
const JOSEPH = member("did:plc:joseph", "Joseph Smith", "joseph.example.com");
const JORGEN = member("did:plc:jorgen", "Jørgen Nielsen", "jorgen.example.com");
const LOUIS = member("did:plc:louis", "Louis Escher", "louis.escher.social");
const RENEE = member("did:plc:renee", "Renée Dubois", "renee.example.com");

const ROSTER = [JOSE, JOSEPH, JORGEN, LOUIS, RENEE];

describe("createMemberIndex", () => {
	beforeEach(() => {
		forgetSpeakers(COMMUNITY);
	});

	it("finds an accented name from an unaccented query", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("Jose", 5)).toContain("did:plc:jose");
		expect(index.search("Renee", 5)).toContain("did:plc:renee");
		expect(index.search("Alvarez", 5)).toContain("did:plc:jose");
	});

	it("finds an unaccented name from an accented query", () => {
		const index = createMemberIndex();
		index.sync([JOSEPH, member("did:plc:plain", "Jose Plain", "plain.test")]);

		expect(index.search("José", 5)).toContain("did:plc:plain");
	});

	it("folds letters that NFD does not decompose", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("Jorgen", 5)).toContain("did:plc:jorgen");
	});

	it("matches on a handle segment", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("escher", 5)).toContain("did:plc:louis");
	});

	it("matches a prefix", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		const hits = index.search("jos", 5);

		expect(hits).toContain("did:plc:jose");
		expect(hits).toContain("did:plc:joseph");
	});

	it("returns nothing for a query with no usable terms", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("", 5)).toEqual([]);
		expect(index.search("   ", 5)).toEqual([]);
	});

	it("honours the limit", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("jos", 1)).toHaveLength(1);
		expect(index.search("jos", 0)).toEqual([]);
	});

	it("puts the more recent speaker first among equally good matches", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		recordSpeaker(COMMUNITY, "did:plc:joseph", "2026-08-21T10:00:00.000Z");
		recordSpeaker(COMMUNITY, "did:plc:jose", "2026-08-21T12:00:00.000Z");

		expect(index.search("jos", 5, speakerRanks(COMMUNITY))[0]).toBe(
			"did:plc:jose",
		);

		recordSpeaker(COMMUNITY, "did:plc:joseph", "2026-08-21T13:00:00.000Z");

		expect(index.search("jos", 5, speakerRanks(COMMUNITY))[0]).toBe(
			"did:plc:joseph",
		);
	});

	it("keeps a clean prefix match ahead of a recent fuzzy match", () => {
		const index = createMemberIndex();
		index.sync([
			member("did:plc:martin", "Martin", "martin.example.com"),
			member("did:plc:marvin", "Marvin", "marvin.example.com"),
		]);

		recordSpeaker(COMMUNITY, "did:plc:marvin", "2026-08-21T13:00:00.000Z");

		expect(index.search("marti", 5, speakerRanks(COMMUNITY))[0]).toBe(
			"did:plc:martin",
		);
	});

	it("reflects an added member", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("Ingrid", 5)).toEqual([]);

		index.sync([...ROSTER, member("did:plc:ingrid", "Ingrid", "ingrid.test")]);

		expect(index.search("Ingrid", 5)).toEqual(["did:plc:ingrid"]);
	});

	it("reflects a renamed member", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		index.sync([
			...ROSTER.filter((m) => m.did !== "did:plc:louis"),
			member("did:plc:louis", "Ludwig Escher", "louis.escher.social"),
		]);

		expect(index.search("Ludwig", 5)).toEqual(["did:plc:louis"]);
		expect(index.search("escher", 5)).toEqual(["did:plc:louis"]);
		expect(index.search("Louis", 5)).toEqual(["did:plc:louis"]);
	});

	it("drops a display name term the rename removed", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		expect(index.search("Alvarez", 5)).toEqual(["did:plc:jose"]);

		index.sync([
			...ROSTER.filter((m) => m.did !== "did:plc:jose"),
			member("did:plc:jose", "José Ruiz", "jose.example.com"),
		]);

		expect(index.search("Ruiz", 5)).toEqual(["did:plc:jose"]);
		expect(index.search("Alvarez", 5)).toEqual([]);
	});

	it("reflects a removed member", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);

		index.sync(ROSTER.filter((m) => m.did !== "did:plc:jorgen"));

		expect(index.search("Jorgen", 5)).toEqual([]);
		expect(index.search("Jose", 5)).toContain("did:plc:jose");
	});

	it("does not reindex when nothing changed", () => {
		const index = createMemberIndex();
		index.sync(ROSTER);
		index.sync([...ROSTER]);
		index.sync([...ROSTER]);

		expect(index.search("jos", 5)).toHaveLength(2);
	});

	it("falls back to the handle when the display name equals the handle", () => {
		const index = createMemberIndex();
		index.sync([
			member("did:plc:bare", "bare.example.com", "bare.example.com"),
		]);

		expect(index.search("bare", 5)).toEqual(["did:plc:bare"]);
	});
});

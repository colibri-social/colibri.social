import { describe, expect, it } from "vitest";
import { bridgedPeople, historyPercent, historyRequest } from "./bridge";

const bridged = (remoteId: string, displayName: string) => ({
	did: "did:plc:community",
	displayName,
	bridge: { registration: "3lkbridgeaaaa", platform: "chat", remoteId },
});

describe("bridgedPeople", () => {
	it("offers each bridged author once, newest first, matching the query", () => {
		const authors = [
			bridged("1", "Nelly"),
			{ did: "did:plc:member", displayName: "Nora" },
			bridged("2", "Nils"),
			bridged("1", "Nelly"),
			bridged("3", "Bob"),
		];

		expect(
			bridgedPeople(authors, "n", 5).map((person) => person.remoteId),
		).toEqual(["1", "2"]);
		expect(bridgedPeople(authors, "", 1)).toEqual([
			{
				registration: "3lkbridgeaaaa",
				platform: "chat",
				remoteId: "1",
				name: "Nelly",
			},
		]);
	});
});

describe("historyRequest", () => {
	const now = new Date("2026-09-24T12:00:00.000Z");

	it("starts a bounded import the chosen number of days back", () => {
		expect(historyRequest("week", now)).toEqual({
			since: "2026-09-17T12:00:00.000Z",
			requestedAt: "2026-09-24T12:00:00.000Z",
		});
	});

	it("leaves the start open for all history", () => {
		expect(historyRequest("all", now)).toEqual({
			requestedAt: "2026-09-24T12:00:00.000Z",
		});
	});
});

describe("historyPercent", () => {
	const range = {
		from: "2026-09-01T00:00:00.000Z",
		until: "2026-09-11T00:00:00.000Z",
	};

	it("measures how much of the time range the import has reached", () => {
		expect(
			historyPercent({
				...range,
				state: "running",
				reached: "2026-09-04T00:00:00.000Z",
			}),
		).toBe(30);
	});

	it("starts at zero before anything is imported", () => {
		expect(historyPercent({ ...range, state: "running" })).toBe(0);
	});

	it("is full once done, and for an empty range", () => {
		expect(historyPercent({ ...range, state: "done" })).toBe(100);
		expect(
			historyPercent({
				from: range.until,
				until: range.until,
				state: "running",
			}),
		).toBe(100);
	});

	it("stays within bounds when reached lies outside the range", () => {
		expect(
			historyPercent({
				...range,
				state: "running",
				reached: "2026-10-01T00:00:00.000Z",
			}),
		).toBe(100);
	});
});

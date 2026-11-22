import { describe, expect, it } from "vitest";
import type { MessageView } from "../../data/types";
import type { ChatMessage } from "./message/types";
import { lastLegacyKey, migrationSeamLabel } from "./migration-seam";

const item = (key: string, legacy?: boolean): ChatMessage =>
	({
		key,
		author: "did:plc:lou",
		timestamp: "2026-10-20T10:00:00.000Z",
		state: "sent",
		text: key,
		facets: [],
		view: { legacy } as MessageView,
	}) as ChatMessage;

describe("migrationSeamLabel", () => {
	it("names the admin and the day", () => {
		expect(
			migrationSeamLabel(
				{ at: "2026-10-20T12:00:00.000Z", by: "did:plc:lou" },
				"lou.colibri.social",
			),
		).toBe(
			"Moved to Spaces by @lou.colibri.social on 20 October 2026. Messages above are read-only.",
		);
	});

	it("leaves out an admin it can't name", () => {
		expect(
			migrationSeamLabel({ at: "2026-10-20T12:00:00.000Z", by: "did:plc:x" }),
		).toBe("Moved to Spaces on 20 October 2026. Messages above are read-only.");
	});
});

describe("lastLegacyKey", () => {
	it("finds the newest legacy message", () => {
		expect(
			lastLegacyKey([item("a", true), item("b", true), item("c"), item("d")]),
		).toBe("b");
	});

	it("is empty when no legacy message is loaded", () => {
		expect(lastLegacyKey([item("c"), item("d")])).toBeUndefined();
	});
});

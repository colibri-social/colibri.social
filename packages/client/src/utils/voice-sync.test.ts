import { describe, expect, it } from "vitest";
import { syncGroupFor } from "./voice-sync";

const did = "did:plc:example";

describe("syncGroupFor", () => {
	it("puts the microphone and the camera in one group", () => {
		expect(syncGroupFor({ did, source: "mic" })).toBe(
			syncGroupFor({ did, source: "cam" }),
		);
	});

	it("keeps screen share in a separate group", () => {
		expect(syncGroupFor({ did, source: "screen" })).not.toBe(
			syncGroupFor({ did, source: "cam" }),
		);
	});

	it("keeps participants apart", () => {
		expect(syncGroupFor({ did, source: "mic" })).not.toBe(
			syncGroupFor({ did: "did:plc:other", source: "mic" }),
		);
	});
});

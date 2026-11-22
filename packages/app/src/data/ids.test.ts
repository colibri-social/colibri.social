import { describe, expect, it } from "vitest";
import { channelSlug, skeyOf, spaceKey } from "./ids";
import type { SpaceRef } from "./types";

describe("ids", () => {
	it("derives the URL keys from lexicon views", () => {
		expect(spaceKey({ did: "did:plc:hq" })).toBe("did:plc:hq");
		const space =
			"at://did:plc:abc/space/social.colibri.beta.channel.text/general" as SpaceRef;
		expect(skeyOf(space)).toBe("general");
		expect(channelSlug({ space })).toBe("general");
	});
});

import { afterEach, describe, expect, it } from "vitest";
import {
	legacySpaceUrisFromFeatures,
	outgoingSpaceUris,
	safeParseSpaceUris,
	setLegacySpaceUris,
} from "./legacy-space-uris.js";

const DID = "did:plc:abc123";
const TEXT = `at:space/${DID}/social.colibri.beta.channel.text/general`;
const LEGACY_TEXT = `at://${DID}/space/social.colibri.beta.channel.text/general`;

afterEach(() => setLegacySpaceUris(true));

describe("legacySpaceUrisFromFeatures", () => {
	it("is on only while the AppView lists the feature", () => {
		expect(legacySpaceUrisFromFeatures(["voice", "legacySpaceUris"])).toBe(
			true,
		);
		expect(legacySpaceUrisFromFeatures(["voice"])).toBe(false);
		expect(legacySpaceUrisFromFeatures(undefined)).toBe(false);
	});
});

describe("outgoingSpaceUris", () => {
	it("sends the legacy form while legacy mode is on", () => {
		setLegacySpaceUris(true);

		expect(outgoingSpaceUris({ space: TEXT, text: `see ${TEXT}` })).toEqual({
			space: LEGACY_TEXT,
			text: `see ${TEXT}`,
		});
	});

	it("sends the new form once legacy mode is off", () => {
		setLegacySpaceUris(false);

		expect(outgoingSpaceUris({ space: LEGACY_TEXT })).toEqual({ space: TEXT });
	});
});

describe("safeParseSpaceUris", () => {
	it("validates the legacy form and hands back the new form", () => {
		const seen: unknown[] = [];
		const result = safeParseSpaceUris<{ space: string }>(
			(input) => {
				seen.push(input);
				return { success: true, value: input };
			},
			{ space: TEXT },
		);

		expect(seen).toEqual([{ space: LEGACY_TEXT }]);
		expect(result).toEqual({ success: true, value: { space: TEXT } });
	});
});

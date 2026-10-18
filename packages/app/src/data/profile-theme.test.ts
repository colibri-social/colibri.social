import { describe, expect, it } from "vitest";
import { profileBannerFill } from "./profile-theme";

describe("profileBannerFill", () => {
	it("draws the two-colour gradient", () => {
		expect(
			profileBannerFill({
				bannerColor: "#111111",
				gradient: { primary: "#a579ff", secondary: "#4dd4c6" },
			}),
		).toBe("linear-gradient(135deg, #a579ff, #4dd4c6)");
	});

	it("falls back to the banner colour", () => {
		expect(profileBannerFill({ bannerColor: "#2b2b31" })).toBe("#2b2b31");
		expect(profileBannerFill({ gradient: { primary: "#a579ff" } })).toBe(
			"#a579ff",
		);
	});

	it("leaves the banner to the avatar tint without a theme", () => {
		expect(profileBannerFill(undefined)).toBeUndefined();
		expect(profileBannerFill({ accentColor: "#a579ff" })).toBeUndefined();
	});

	it("drops values that aren't hex colours", () => {
		expect(
			profileBannerFill({
				gradient: { primary: "url(https://x.test)", secondary: "#4dd4c6" },
			}),
		).toBeUndefined();
		expect(profileBannerFill({ bannerColor: "red" })).toBeUndefined();
	});
});

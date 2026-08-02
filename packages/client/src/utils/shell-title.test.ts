import { describe, expect, it } from "vitest";
import { composeShellTitle } from "./shell-title";

describe("composeShellTitle", () => {
	it("returns an empty string with no community", () => {
		expect(composeShellTitle(undefined, undefined)).toBe("");
		expect(
			composeShellTitle(undefined, { name: "general", type: "text" }),
		).toBe("");
	});

	it("returns the community name alone with no channel", () => {
		expect(composeShellTitle("Colibri", undefined)).toBe("Colibri");
	});

	it("joins the channel and community without a hash prefix", () => {
		expect(
			composeShellTitle("Colibri", { name: "general", type: "text" }),
		).toBe("general · Colibri");
	});

	it("treats full-NSID text channels the same way", () => {
		expect(
			composeShellTitle("Colibri", {
				name: "general",
				type: "social.colibri.channel.text",
			}),
		).toBe("general · Colibri");
	});

	it("formats voice channels the same way", () => {
		expect(
			composeShellTitle("Colibri", {
				name: "Lounge",
				type: "social.colibri.channel.voice",
			}),
		).toBe("Lounge · Colibri");
	});
});

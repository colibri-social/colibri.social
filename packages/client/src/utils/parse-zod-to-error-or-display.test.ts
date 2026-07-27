import { describe, expect, it } from "vitest";
import { parseZodToErrorOrDisplay } from "./parse-zod-to-error-or-display";

describe("parseZodToErrorOrDisplay", () => {
	it("passes a plain message through untouched", () => {
		expect(parseZodToErrorOrDisplay("Something went wrong")).toBe(
			"Something went wrong",
		);
	});

	it("passes an empty message through untouched", () => {
		expect(parseZodToErrorOrDisplay("")).toBe("");
	});

	it("extracts the first issue message from a zod payload", () => {
		const message = `Failed to validate: ${JSON.stringify([
			{ message: "Name is required" },
			{ message: "Description is too long" },
		])}`;

		expect(parseZodToErrorOrDisplay(message)).toBe("Name is required");
	});

	it("handles a payload with a single issue", () => {
		const message = `Failed to validate: ${JSON.stringify([
			{ message: "Only one thing wrong" },
		])}`;

		expect(parseZodToErrorOrDisplay(message)).toBe("Only one thing wrong");
	});

	it("throws when the marker is present but the remainder is not valid json", () => {
		const message = `Error: Failed to validate: ${JSON.stringify([
			{ message: "Nested" },
		])}`;

		expect(() => parseZodToErrorOrDisplay(message)).toThrow(SyntaxError);
	});

	it("throws when the marker is present with no payload at all", () => {
		expect(() => parseZodToErrorOrDisplay("Failed to validate:")).toThrow(
			SyntaxError,
		);
	});
});

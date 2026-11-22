import { describe, expect, it } from "vitest";
import { WRITE_FAILURE_COPY, writeFailureCopy } from "./WriteFailureToasts";

describe("writeFailureCopy", () => {
	it("explains a file the account's host rejects as too large", () => {
		const copy = writeFailureCopy({
			kind: "send",
			code: "ServerFileTooLarge",
		});

		expect(copy.title).toBe("That file is too big for your account");
		expect(copy.description).toContain("Try a smaller file.");
	});

	it("keeps the per-kind copy for other codes", () => {
		expect(writeFailureCopy({ kind: "edit", code: "Unexpected" })).toEqual(
			WRITE_FAILURE_COPY.edit,
		);
	});
});

import { ColibriError } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { TransferOwnershipError } from "../../../data/source";
import { TRANSFER_COPY, transferErrorCopy } from "./transfer.contract";

describe("transfer error copy", () => {
	it("explains each refusal from the AppView", () => {
		expect(
			transferErrorCopy(new TransferOwnershipError("AlreadyOwner")),
		).toEqual({
			title: TRANSFER_COPY.failed,
			description: TRANSFER_COPY.errors.AlreadyOwner,
		});
		expect(transferErrorCopy(new TransferOwnershipError("Banned"))).toEqual({
			title: TRANSFER_COPY.failed,
			description: TRANSFER_COPY.errors.Banned,
		});
	});

	it("uses the shared error copy for every other failure", () => {
		expect(
			transferErrorCopy(new ColibriError({ code: "CredentialsUnavailable" })),
		).toEqual({
			title: TRANSFER_COPY.failed,
			description:
				"An owner has to reconnect the Space before this works again.",
		});
		expect(transferErrorCopy(new Error("boom")).description).toBe(
			"Give it another try. If it keeps happening, restart Colibri.",
		);
	});
});

import { classifyThrown, colibri } from "@colibri-social/lib";
import {
	TransferOwnershipError,
	type TransferOwnershipErrorCode,
	type TransferOwnershipInput,
	type TransferOwnershipOutput,
} from "../source";
import type { MemberView } from "../types";
import type { Transport } from "./transport";

const TRANSFER_CODES: ReadonlySet<string> = new Set<TransferOwnershipErrorCode>(
	[
		"Forbidden",
		"CommunityNotFound",
		"MemberNotFound",
		"Banned",
		"AlreadyOwner",
	],
);

const isTransferCode = (code: unknown): code is TransferOwnershipErrorCode =>
	typeof code === "string" && TRANSFER_CODES.has(code);

export const transferOwnershipFailure = (error: unknown) => {
	const failure = classifyThrown(error, {
		method: colibri.community.transferOwnership.main.nsid,
	});
	const unknownCode = failure.context.unknownCode;
	if (isTransferCode(failure.code))
		return new TransferOwnershipError(failure.code);
	if (isTransferCode(unknownCode))
		return new TransferOwnershipError(unknownCode);
	return failure;
};

export const createTransferOwnership =
	(transport: Transport) =>
	async (input: TransferOwnershipInput): Promise<TransferOwnershipOutput> => {
		try {
			const result = await transport.procedure(
				colibri.community.transferOwnership.main,
				{ body: input },
			);
			return {
				owner: result.owner as MemberView,
				previousOwner: result.previousOwner as MemberView,
			};
		} catch (error) {
			throw transferOwnershipFailure(error);
		}
	};

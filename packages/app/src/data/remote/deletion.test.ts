import { ColibriError, colibri } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import type { PreferencesSpace } from "../preferences/remote";
import { createDeletion, PERSONAL_COLLECTIONS } from "./deletion";
import type { Records } from "./records";
import type { Transport } from "./transport";

const DID = "did:plc:viewer";
const SPACE = "at://did:plc:viewer/space/prefs/self";

const setup = (options: { failDelete?: string } = {}) => {
	const procedure = vi.fn(async () => ({ deleted: 3 }));
	const pdsProcedure = vi.fn(async () => ({}));
	const transport = {
		did: DID,
		query: vi.fn(async () => ({
			records: 3,
			notifications: 1,
			soleOwnedCommunities: [],
		})),
		procedure,
		pdsQuery: vi.fn(async () => ({
			did: "did:web:pds.example.com",
			contact: { email: "help@example.com" },
		})),
		pdsProcedure,
	} as unknown as Transport;
	const listInSpace = vi.fn(async ({ collection }: { collection: string }) => {
		if (collection === PERSONAL_COLLECTIONS[0])
			return [{ collection, rkey: "self", cid: "bafyself", value: {} }];
		if (collection === PERSONAL_COLLECTIONS[3])
			return [
				{ collection, rkey: "a", cid: "bafya", value: {} },
				{ collection, rkey: "b", cid: "bafyb", value: {} },
			];
		throw new ColibriError({ code: "NotFound" });
	});
	const deleteInSpace = vi.fn(async (target: { rkey: string }) => {
		if (target.rkey === options.failDelete)
			throw new ColibriError({ code: "Unexpected" });
	});
	const records = { listInSpace, deleteInSpace } as unknown as Records;
	const space = { space: SPACE } as unknown as PreferencesSpace;
	return {
		deletion: createDeletion({ transport, records, space }),
		procedure,
		pdsProcedure,
		deleteInSpace,
	};
};

describe("createDeletion", () => {
	it("describes the account host and Spaces that block deletion", async () => {
		const { deletion } = setup();
		expect(await deletion.getDeletionStatus()).toEqual({
			soleOwned: [],
			host: { name: "pds.example.com", contactEmail: "help@example.com" },
		});
	});

	it("removes personal records, the profile and then the AppView data", async () => {
		const { deletion, procedure, pdsProcedure, deleteInSpace } = setup();
		const progress = vi.fn();
		expect(await deletion.deleteColibriData(progress)).toEqual({
			incomplete: false,
		});
		expect(deleteInSpace.mock.calls.map(([target]) => target.rkey)).toEqual([
			"self",
			"a",
			"b",
		]);
		expect(pdsProcedure).toHaveBeenCalledWith("com.atproto.repo.deleteRecord", {
			body: {
				repo: DID,
				collection: "social.colibri.beta.actor.profile",
				rkey: "self",
			},
		});
		expect(procedure).toHaveBeenCalledWith(colibri.actor.deleteAccount.main, {
			body: {},
		});
		expect(progress).toHaveBeenLastCalledWith({ step: "server" });
	});

	it("reports an incomplete result when a record stays behind", async () => {
		const { deletion, procedure } = setup({ failDelete: "a" });
		expect(await deletion.deleteColibriData()).toEqual({ incomplete: true });
		expect(procedure).toHaveBeenCalledOnce();
	});
});

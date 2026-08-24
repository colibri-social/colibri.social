import { describe, expect, it } from "vitest";
import { AtURI, messageIdentity, toRecordUri } from "./at-uri";

const DID = "did:plc:abc123";
const COLLECTION = "social.colibri.message";

describe("toRecordUri", () => {
	it("builds a full uri from a bare rkey", () => {
		expect(toRecordUri(DID, COLLECTION, "3lk2abc")).toBe(
			`at://${DID}/${COLLECTION}/3lk2abc`,
		);
	});

	it("passes an existing at-uri through untouched", () => {
		const uri = "at://did:plc:other/social.colibri.channel/chan-a";
		expect(toRecordUri(DID, COLLECTION, uri)).toBe(uri);
	});

	it("does not treat a bare rkey that merely contains at:// as a uri", () => {
		expect(toRecordUri(DID, COLLECTION, "x-at://y")).toBe(
			`at://${DID}/${COLLECTION}/x-at://y`,
		);
	});
});

describe("messageIdentity", () => {
	const CHANNEL =
		"at://did:plc:community/space/social.colibri.beta.channel.text/3mttl45nkb22p";
	const MESSAGE_COLLECTION = "social.colibri.beta.message";

	it("reads the author did and rkey from a channel-scoped message uri", () => {
		expect(
			messageIdentity(`${CHANNEL}/${DID}/${MESSAGE_COLLECTION}/3lk2abc`),
		).toEqual({ did: DID, rkey: "3lk2abc" });
	});

	it("reads a plain repo message uri", () => {
		expect(
			messageIdentity(`at://${DID}/${MESSAGE_COLLECTION}/3lk2abc`),
		).toEqual({ did: DID, rkey: "3lk2abc" });
	});

	it("rejects a channel uri", () => {
		expect(messageIdentity(CHANNEL)).toBeUndefined();
	});

	it("rejects a uri from another collection", () => {
		expect(
			messageIdentity(`at://${DID}/social.colibri.beta.reaction/3lk2abc`),
		).toBeUndefined();
	});
});

describe("AtURI.parseAtURI", () => {
	it("splits a record uri into did, collection and identifier", () => {
		expect(AtURI.parseAtURI(`at://${DID}/${COLLECTION}/3lk2abc`)).toEqual({
			did: DID,
			collection: COLLECTION,
			identifier: "3lk2abc",
		});
	});

	it("leaves collection and identifier undefined for a bare repo uri", () => {
		expect(AtURI.parseAtURI(`at://${DID}`)).toEqual({
			did: DID,
			collection: undefined,
			identifier: undefined,
		});
	});

	it("leaves identifier undefined for a collection uri", () => {
		expect(AtURI.parseAtURI(`at://${DID}/${COLLECTION}`)).toEqual({
			did: DID,
			collection: COLLECTION,
			identifier: undefined,
		});
	});

	it("ignores trailing segments beyond the identifier", () => {
		expect(
			AtURI.parseAtURI(`at://${DID}/${COLLECTION}/3lk2abc/extra`).identifier,
		).toBe("3lk2abc");
	});
});

describe("AtURI", () => {
	it("exposes the parsed parts and retains the original uri", () => {
		const uri = `at://${DID}/${COLLECTION}/3lk2abc`;
		const parsed = new AtURI(uri);

		expect(parsed.uri).toBe(uri);
		expect(parsed.did).toBe(DID);
		expect(parsed.collection).toBe(COLLECTION);
		expect(parsed.identifier).toBe("3lk2abc");
	});

	it("round-trips through toRecordUri", () => {
		const parsed = new AtURI(`at://${DID}/${COLLECTION}/3lk2abc`);
		expect(toRecordUri(parsed.did, parsed.collection, parsed.identifier)).toBe(
			parsed.uri,
		);
	});
});

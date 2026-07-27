import { describe, expect, it } from "vitest";
import {
	BSKY_MU_TRUSTED_LIST_KEY,
	bskyHandleKey,
	bskyMuVerificationKey,
	bskyPostKey,
	communityKey,
	labelerLabelsKey,
	messagesKey,
	namespace,
} from "./keys";

const APPVIEW = "did:web:api.colibri.social";
const DID = "did:plc:abc123";

describe("namespace", () => {
	it("scopes a user to an appview", () => {
		expect(namespace(APPVIEW, DID)).toBe(`${APPVIEW}:${DID}`);
	});

	it("keeps the same user separate across appviews", () => {
		expect(namespace(APPVIEW, DID)).not.toBe(
			namespace("did:web:other.example", DID),
		);
	});

	it("keeps different users separate within one appview", () => {
		expect(namespace(APPVIEW, DID)).not.toBe(
			namespace(APPVIEW, "did:plc:other"),
		);
	});
});

describe("namespaced keys", () => {
	const ns = namespace(APPVIEW, DID);

	it("prefixes a community key with its namespace", () => {
		const uri = "at://did:plc:owner/social.colibri.community/c1";
		expect(communityKey(ns, uri)).toBe(`${ns}:${uri}`);
	});

	it("prefixes a messages key with its namespace", () => {
		const uri = "at://did:plc:owner/social.colibri.channel/chan-a";
		expect(messagesKey(ns, uri)).toBe(`${ns}:${uri}`);
	});

	it("keeps cached data from different appviews apart", () => {
		const uri = "at://did:plc:owner/social.colibri.community/c1";
		expect(communityKey(ns, uri)).not.toBe(
			communityKey(namespace("did:web:other.example", DID), uri),
		);
	});
});

describe("bluesky and labeler keys", () => {
	it("prefixes post keys", () => {
		expect(bskyPostKey("at://did:plc:x/app.bsky.feed.post/1")).toBe(
			"post:at://did:plc:x/app.bsky.feed.post/1",
		);
	});

	it("prefixes handle keys", () => {
		expect(bskyHandleKey("alice.bsky.social")).toBe("handle:alice.bsky.social");
	});

	it("prefixes verification keys", () => {
		expect(bskyMuVerificationKey(DID)).toBe(`muVerification:${DID}`);
	});

	it("prefixes labeler keys", () => {
		expect(labelerLabelsKey(DID)).toBe(`labels:${DID}`);
	});

	it("uses a distinct prefix per key kind", () => {
		const prefixes = [
			bskyPostKey("x"),
			bskyHandleKey("x"),
			bskyMuVerificationKey("x"),
			labelerLabelsKey("x"),
		].map((key) => key.split(":")[0]);

		expect(new Set(prefixes).size).toBe(prefixes.length);
	});

	it("exposes a constant trusted-list key", () => {
		expect(BSKY_MU_TRUSTED_LIST_KEY).toBe("muTrustedList");
	});
});

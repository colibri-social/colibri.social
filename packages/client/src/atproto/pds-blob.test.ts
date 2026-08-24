import type { JsonBlobRef } from "@atproto/lexicon";
import { describe, expect, it } from "vitest";
import { pdsBlobUrl } from "./pds-blob";

const DID = "did:plc:abc123";

const blob = { cid: "bafyblob", mimeType: "image/png" } as JsonBlobRef;

describe("pdsBlobUrl", () => {
	it("builds a getBlob url against the given host", () => {
		expect(pdsBlobUrl("pds.example", DID, blob)).toBe(
			`https://pds.example/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=bafyblob`,
		);
	});

	it("keeps an explicit scheme, including a local http host", () => {
		expect(pdsBlobUrl("http://127.0.0.1:3001", DID, blob)).toBe(
			`http://127.0.0.1:3001/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=bafyblob`,
		);
	});

	it("trims a trailing slash", () => {
		expect(pdsBlobUrl("https://pds.example/", DID, blob)).toBe(
			`https://pds.example/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=bafyblob`,
		);
	});

	it("reads a ref-shaped blob", () => {
		const ref = {
			$type: "blob",
			ref: { $link: "bafyref" },
			mimeType: "image/png",
			size: 1,
		} as unknown as JsonBlobRef;

		expect(pdsBlobUrl("pds.example", DID, ref)).toContain("cid=bafyref");
	});

	it("returns undefined without a host or a blob", () => {
		expect(pdsBlobUrl(undefined, DID, blob)).toBeUndefined();
		expect(pdsBlobUrl("pds.example", DID, undefined)).toBeUndefined();
	});
});

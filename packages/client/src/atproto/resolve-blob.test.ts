import type { JsonBlobRef } from "@atproto/lexicon";
import { describe, expect, it } from "vitest";
import { resolveBlob, resolveBlobDownload } from "./resolve-blob";

const DID = "did:plc:abc123";
const CID = "bafkreiexamplecid";

const blob = {
	$type: "blob",
	ref: { $link: CID },
	mimeType: "text/plain",
	size: 12,
} as unknown as JsonBlobRef;

describe("resolveBlob", () => {
	it("builds an unadorned blob URL", () => {
		expect(resolveBlob(DID, blob)).toContain(
			`/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${CID}`,
		);
	});

	it("never carries a filename, so display callers stay inline", () => {
		expect(resolveBlob(DID, blob)).not.toContain("filename");
	});

	it("appends a requested variant", () => {
		expect(resolveBlob(DID, blob, "small")).toContain("&variant=small");
	});

	it("returns undefined without a blob", () => {
		expect(resolveBlob(DID, undefined)).toBeUndefined();
	});
});

describe("resolveBlobDownload", () => {
	it("appends the filename that opts into Content-Disposition", () => {
		expect(resolveBlobDownload(DID, blob, "notes.txt")).toContain(
			"&filename=notes.txt",
		);
	});

	it("never requests a variant, since a download wants the original bytes", () => {
		expect(resolveBlobDownload(DID, blob, "notes.txt")).not.toContain(
			"variant",
		);
	});

	it("percent-encodes characters that would otherwise split the query", () => {
		const url = resolveBlobDownload(DID, blob, "a b&c=d#e.txt");

		expect(url).toContain("&filename=a%20b%26c%3Dd%23e.txt");
		expect(new URL(url as string).searchParams.get("filename")).toBe(
			"a b&c=d#e.txt",
		);
	});

	it("round-trips a non-ASCII name", () => {
		const url = resolveBlobDownload(DID, blob, "Präsentation.pdf");

		expect(new URL(url as string).searchParams.get("filename")).toBe(
			"Präsentation.pdf",
		);
	});

	it("falls back to the plain URL when no name is known", () => {
		expect(resolveBlobDownload(DID, blob)).toBe(resolveBlob(DID, blob));
	});

	it("returns undefined without a blob", () => {
		expect(resolveBlobDownload(DID, undefined, "notes.txt")).toBeUndefined();
	});
});

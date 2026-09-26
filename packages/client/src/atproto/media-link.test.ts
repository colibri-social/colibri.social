import { describe, expect, it } from "vitest";
import {
	canKeepMediaLinks,
	isMediaLinkExpired,
	liveMediaLink,
	mediaLinkTarget,
} from "./media-link";

const NOW_MS = 1_800_000_000_000;
const link = (exp?: string): string => {
	const url = new URL(
		"https://appview.example/xrpc/social.colibri.beta.blob.get",
	);
	url.searchParams.set("did", "did:plc:abc123");
	url.searchParams.set("cid", "bafkrei");
	if (exp !== undefined) url.searchParams.set("exp", exp);
	return url.toString();
};

describe("isMediaLinkExpired", () => {
	it("reports a link whose exp has passed", () => {
		expect(isMediaLinkExpired(link(String(NOW_MS / 1000 - 1)), NOW_MS)).toBe(
			true,
		);
	});

	it("reports a link that expires right now", () => {
		expect(isMediaLinkExpired(link(String(NOW_MS / 1000)), NOW_MS)).toBe(true);
	});

	it("accepts a link whose exp is in the future", () => {
		expect(isMediaLinkExpired(link(String(NOW_MS / 1000 + 60)), NOW_MS)).toBe(
			false,
		);
	});

	it("accepts a link without exp", () => {
		expect(isMediaLinkExpired(link(), NOW_MS)).toBe(false);
	});

	it("accepts a link with an empty or garbage exp", () => {
		expect(isMediaLinkExpired(link(""), NOW_MS)).toBe(false);
		expect(isMediaLinkExpired(link("soon"), NOW_MS)).toBe(false);
	});

	it("accepts a string that is not a URL", () => {
		expect(isMediaLinkExpired("not a url", NOW_MS)).toBe(false);
	});
});

describe("mediaLinkTarget", () => {
	it("drops the signature so re-signed links compare equal", () => {
		expect(mediaLinkTarget(`${link("100")}&sig=abc`)).toBe(
			mediaLinkTarget(`${link("200")}&sig=def`),
		);
	});

	it("keeps the blob identity", () => {
		expect(mediaLinkTarget(link("100"))).toContain("cid=bafkrei");
	});
});

describe("canKeepMediaLinks", () => {
	const future = String(NOW_MS / 1000 + 60);
	const past = String(NOW_MS / 1000 - 60);

	it("keeps unexpired links to the same blobs", () => {
		expect(
			canKeepMediaLinks([{ url: link(future) }], [{ url: link("9") }], NOW_MS),
		).toBe(true);
	});

	it("drops expired links", () => {
		expect(
			canKeepMediaLinks([{ url: link(past) }], [{ url: link(future) }], NOW_MS),
		).toBe(false);
	});

	it("drops links when the attachment count changed", () => {
		expect(canKeepMediaLinks([], [{ url: link(future) }], NOW_MS)).toBe(false);
	});
});

describe("liveMediaLink", () => {
	const future = String(NOW_MS / 1000 + 60);
	const past = String(NOW_MS / 1000 - 60);

	it("finds the renewed link for the same blob", () => {
		const renewed = `${link(future)}&sig=new`;
		expect(
			liveMediaLink([{ url: renewed }], `${link(past)}&sig=old`, NOW_MS),
		).toBe(renewed);
	});

	it("returns nothing while the only match is still expired", () => {
		expect(liveMediaLink([{ url: link(past) }], link(past), NOW_MS)).toBe(
			undefined,
		);
	});

	it("returns nothing when no candidate points at the blob", () => {
		const other = link(future).replace("bafkrei", "bafkother");
		expect(liveMediaLink([{ url: other }], link(past), NOW_MS)).toBe(undefined);
	});
});

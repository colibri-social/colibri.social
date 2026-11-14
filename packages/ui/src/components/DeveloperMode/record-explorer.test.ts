import { afterEach, describe, expect, it } from "vitest";
import {
	expandExplorerTemplate,
	explorerTemplateHost,
	explorerTemplateProblem,
	recordExplorerHref,
	recordExplorerName,
	recordPartsOf,
	setCustomRecordExplorerTemplate,
	setRecordExplorer,
} from "./record-explorer-links";

const SPACE_MESSAGE =
	"at://did:plc:owner/space/social.colibri.beta.channel.text/3mttl45nkb22p/did:plc:author/social.colibri.beta.message/3n2btgqq2o2hk";

const partsOf = (value: string) => {
	const parts = recordPartsOf(value);

	if (!parts) throw new Error(`No parts for ${value}`);

	return parts;
};

const record = partsOf("at://did:plc:abc/app.bsky.feed.post/3k2");

const identity = partsOf("did:plc:abc");

afterEach(() => {
	setRecordExplorer("pdsls");
	setCustomRecordExplorerTemplate("");
});

describe("recordPartsOf", () => {
	it("splits a Space record into owner, Space and author parts", () => {
		expect(partsOf(SPACE_MESSAGE)).toEqual({
			uri: SPACE_MESSAGE,
			authority: "did:plc:owner",
			spaceType: "social.colibri.beta.channel.text",
			spaceKey: "3mttl45nkb22p",
			repo: "did:plc:author",
			collection: "social.colibri.beta.message",
			rkey: "3n2btgqq2o2hk",
		});
	});

	it("uses the owner as the repo of a Space itself", () => {
		expect(
			partsOf(
				"at://did:plc:owner/space/social.colibri.beta.channel.text/3mttl",
			),
		).toMatchObject({
			authority: "did:plc:owner",
			repo: "did:plc:owner",
			spaceKey: "3mttl",
			collection: "",
			rkey: "",
		});
	});

	it("uses the authority as the repo of a plain record", () => {
		expect(record).toMatchObject({
			authority: "did:plc:abc",
			repo: "did:plc:abc",
			spaceType: "",
			spaceKey: "",
		});
	});
});

describe("expandExplorerTemplate", () => {
	it("fills every placeholder for a record", () => {
		expect(
			expandExplorerTemplate(
				"https://x.dev/{repo}/{collection}/{rkey}",
				record,
			),
		).toBe("https://x.dev/did:plc:abc/app.bsky.feed.post/3k2");
	});

	it("fills the Space placeholders", () => {
		expect(
			expandExplorerTemplate(
				"https://x.dev/{authority}/{spaceType}/{spaceKey}/{repo}/{rkey}",
				partsOf(SPACE_MESSAGE),
			),
		).toBe(
			"https://x.dev/did:plc:owner/social.colibri.beta.channel.text/3mttl45nkb22p/did:plc:author/3n2btgqq2o2hk",
		);
	});

	it("drops the slash before a missing part", () => {
		expect(
			expandExplorerTemplate(
				"https://x.dev/{authority}/{spaceType}/{spaceKey}/{collection}",
				record,
			),
		).toBe("https://x.dev/did:plc:abc/app.bsky.feed.post");
		expect(
			expandExplorerTemplate(
				"https://x.dev/{repo}/{collection}/{rkey}",
				identity,
			),
		).toBe("https://x.dev/did:plc:abc");
	});

	it("expands the full and bare AT URI", () => {
		expect(
			expandExplorerTemplate("https://x.dev/{uri}", partsOf(SPACE_MESSAGE)),
		).toBe(`https://x.dev/${SPACE_MESSAGE}`);
		expect(expandExplorerTemplate("https://x.dev/r/{uri:bare}", identity)).toBe(
			"https://x.dev/r/did:plc:abc",
		);
	});

	it("fills placeholders in the query string", () => {
		expect(expandExplorerTemplate("https://x.dev/?q={repo}", record)).toBe(
			"https://x.dev/?q=did:plc:abc",
		);
	});
});

describe("explorerTemplateProblem", () => {
	it("accepts a template with an identifier placeholder", () => {
		expect(explorerTemplateProblem("https://x.dev/{uri}")).toBeUndefined();
		expect(
			explorerTemplateProblem("https://x.dev/{authority}"),
		).toBeUndefined();
	});

	it("rejects broken templates", () => {
		expect(explorerTemplateProblem("  ")).toBe("empty");
		expect(explorerTemplateProblem("https://x.dev/{spaceKey}")).toBe(
			"missingIdentifier",
		);
		expect(explorerTemplateProblem("https://x.dev/{did}")).toBe(
			"unknownPlaceholder",
		);
		expect(explorerTemplateProblem("javascript:alert({repo})")).toBe(
			"unsupportedProtocol",
		);
		expect(explorerTemplateProblem("x.dev/{repo}")).toBe("invalidUrl");
	});
});

describe("custom explorer", () => {
	it("links and names by the template host", () => {
		setCustomRecordExplorerTemplate("https://explorer.example/{uri:bare}");
		setRecordExplorer("custom");

		expect(explorerTemplateHost("https://explorer.example/{repo}")).toBe(
			"explorer.example",
		);
		expect(recordExplorerName()).toBe("explorer.example");
		expect(recordExplorerHref(SPACE_MESSAGE)).toBe(
			`https://explorer.example/${SPACE_MESSAGE.slice("at://".length)}`,
		);
	});

	it("falls back to PDSls while the template is invalid", () => {
		setCustomRecordExplorerTemplate("https://explorer.example/");
		setRecordExplorer("custom");

		expect(recordExplorerName()).toBe("PDSls");
		expect(recordExplorerHref("did:plc:abc")).toBe(
			"https://pdsls.dev/at://did:plc:abc",
		);
	});
});

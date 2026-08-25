import { describe, expect, it } from "vitest";
import {
	isDisguisedLink,
	isSafeLinkUri,
	labelHost,
	MARKDOWN_LINK_POLICY,
} from "./link-safety";

describe("isSafeLinkUri", () => {
	it("accepts http, https and mailto", () => {
		expect(isSafeLinkUri("http://good.test")).toBe(true);
		expect(isSafeLinkUri("https://good.test/a?b=c#d")).toBe(true);
		expect(isSafeLinkUri("mailto:someone@good.test")).toBe(true);
	});

	it("rejects every other scheme", () => {
		expect(isSafeLinkUri("javascript:alert(1)")).toBe(false);
		expect(isSafeLinkUri("data:text/html,<script>x</script>")).toBe(false);
		expect(isSafeLinkUri("file:///etc/passwd")).toBe(false);
		expect(isSafeLinkUri("at://did:plc:abc/app.bsky.feed.post/1")).toBe(false);
	});

	it("rejects strings that aren't URLs", () => {
		expect(isSafeLinkUri("")).toBe(false);
		expect(isSafeLinkUri("not a url")).toBe(false);
	});
});

describe("labelHost", () => {
	it("reads a host out of a label with a scheme", () => {
		expect(labelHost("https://good.test/a")).toBe("good.test");
	});

	it("reads a host out of a bare domain", () => {
		expect(labelHost("example.com")).toBe("example.com");
		expect(labelHost("www.example.com/path")).toBe("www.example.com");
	});

	it("returns null for labels that aren't URLs", () => {
		expect(labelHost("click here")).toBeNull();
		expect(labelHost("")).toBeNull();
		expect(labelHost("v1.2")).toBeNull();
		expect(labelHost("notes.txt")).toBeNull();
	});
});

describe("isDisguisedLink", () => {
	it("catches a URL label pointing somewhere else", () => {
		expect(isDisguisedLink("https://good.test", "https://bad.test")).toBe(true);
	});

	it("catches a bare-domain label pointing somewhere else", () => {
		expect(isDisguisedLink("paypal.com", "https://bad.test")).toBe(true);
	});

	it("catches a homoglyph host", () => {
		expect(isDisguisedLink("https://gооgle.com", "https://google.com")).toBe(
			true,
		);
	});

	it("allows a different path on the same host", () => {
		expect(isDisguisedLink("https://good.test/a", "https://good.test/b")).toBe(
			false,
		);
	});

	it("allows a different scheme on the same host", () => {
		expect(isDisguisedLink("https://good.test", "http://good.test")).toBe(
			false,
		);
	});

	it("ignores a leading www on either side", () => {
		expect(isDisguisedLink("www.good.test", "https://good.test")).toBe(false);
		expect(isDisguisedLink("good.test", "https://www.good.test")).toBe(false);
	});

	it("leaves non-URL labels alone", () => {
		expect(isDisguisedLink("click here", "https://bad.test")).toBe(false);
		expect(isDisguisedLink("notes.txt", "https://github.com/x/y")).toBe(false);
	});

	it("allows a label that names a segment of the target's path", () => {
		expect(
			isDisguisedLink("README.md", "https://github.com/x/y/README.md"),
		).toBe(false);
		expect(
			isDisguisedLink("main.ts", "https://github.com/x/blob/main/src/main.ts"),
		).toBe(false);
	});

	it("doesn't let a query string vouch for the label", () => {
		expect(
			isDisguisedLink("paypal.com", "https://bad.test/?ref=paypal.com"),
		).toBe(true);
	});

	it("treats an unparseable target as disguised", () => {
		expect(isDisguisedLink("https://good.test", "not a url")).toBe(true);
	});
});

describe("MARKDOWN_LINK_POLICY", () => {
	it("rejects disguised links and unsafe schemes together", () => {
		expect(
			MARKDOWN_LINK_POLICY.allowLink("https://good.test", "https://bad.test"),
		).toBe(false);
		expect(
			MARKDOWN_LINK_POLICY.allowLink("click me", "javascript:alert(1)"),
		).toBe(false);
		expect(MARKDOWN_LINK_POLICY.allowLink("click me", "https://bad.test")).toBe(
			true,
		);
	});
});

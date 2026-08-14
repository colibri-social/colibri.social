import { describe, expect, it } from "vitest";
import { classifyLinkTarget } from "./link-target";

const base = {
	href: null as string | null,
	isDownload: false,
	origin: "https://colibri.social",
};

describe("classifyLinkTarget", () => {
	it("treats an absolute http(s) href as an external link", () => {
		expect(
			classifyLinkTarget({ ...base, href: "https://example.com/page?a=1" }),
		).toEqual({
			kind: "external",
			href: "https://example.com/page?a=1",
			copyHref: "https://example.com/page?a=1",
		});
	});

	it("copies the rendered href of a rewritten Bluesky link", () => {
		const href = "https://deer.social/profile/alice.test/post/3k";
		expect(classifyLinkTarget({ ...base, href })).toEqual({
			kind: "external",
			href,
			copyHref: href,
		});
	});

	it("turns a router path into an absolute copy value", () => {
		expect(classifyLinkTarget({ ...base, href: "/app/invite/abc123" })).toEqual(
			{
				kind: "internal",
				href: "/app/invite/abc123",
				copyHref: "https://colibri.social/app/invite/abc123",
			},
		);
	});

	it("does not double the slash when the origin has a trailing one", () => {
		expect(
			classifyLinkTarget({
				...base,
				href: "/app/c/example",
				origin: "https://colibri.social/",
			}),
		).toEqual({
			kind: "internal",
			href: "/app/c/example",
			copyHref: "https://colibri.social/app/c/example",
		});
	});

	it("ignores download anchors", () => {
		expect(
			classifyLinkTarget({
				...base,
				href: "blob:https://colibri.social/1234",
				isDownload: true,
			}),
		).toBeUndefined();
	});

	it("ignores fragment-only and unsupported hrefs", () => {
		expect(classifyLinkTarget({ ...base, href: "#top" })).toBeUndefined();
		expect(
			classifyLinkTarget({ ...base, href: "javascript:alert(1)" }),
		).toBeUndefined();
	});

	it("resolves nothing without an href", () => {
		expect(classifyLinkTarget(base)).toBeUndefined();
	});
});

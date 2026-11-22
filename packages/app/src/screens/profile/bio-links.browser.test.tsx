import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bioSegments, linkifyBio } from "./bio-links";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
});

describe("bio links", () => {
	it("splits links and mentions out of the text", () => {
		expect(
			bioSegments("Birds at example.com/birds, ping @ana.bsky.social\nhi"),
		).toEqual([
			{ kind: "text", text: "Birds at " },
			{
				kind: "link",
				text: "example.com/birds",
				href: "https://example.com/birds",
			},
			{ kind: "text", text: ", ping " },
			{ kind: "mention", text: "@ana.bsky.social", handle: "ana.bsky.social" },
			{ kind: "text", text: "\nhi" },
		]);
		expect(bioSegments("mail me at a@b")).toEqual([
			{ kind: "text", text: "mail me at a@b" },
		]);
	});

	it("keeps sentence punctuation and emails out of links", () => {
		const links = (text: string) =>
			bioSegments(text)
				.filter((segment) => segment.kind === "link")
				.map((segment) => segment.text);
		expect(links("Visit lou.gg.")).toEqual(["lou.gg"]);
		expect(links("Sites: lou.gg, colibri.social!")).toEqual([
			"lou.gg",
			"colibri.social",
		]);
		expect(links("(see https://lou.gg/a)")).toEqual(["https://lou.gg/a"]);
		expect(links("wiki en.wikipedia.org/wiki/Bird_(disambiguation)")).toEqual([
			"en.wikipedia.org/wiki/Bird_(disambiguation)",
		]);
		expect(links("mail hi@lou.gg")).toEqual([]);
	});

	it("routes plain clicks through the link handler", () => {
		const onLink = vi.fn();
		const host = document.createElement("div");
		document.body.append(host);
		dispose = render(
			() =>
				linkifyBio("See https://lou.gg and @ana.bsky.social", {
					profileHref: (handle) => `https://bsky.app/profile/${handle}`,
					onLink,
				}),
			host,
		);
		const links = Array.from(host.querySelectorAll("a"));
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"https://lou.gg",
			"https://bsky.app/profile/ana.bsky.social",
		]);
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		links[0]?.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);
		expect(onLink).toHaveBeenCalledWith("https://lou.gg", "https://lou.gg");
		links[1]?.dispatchEvent(
			new MouseEvent("click", { bubbles: true, cancelable: true }),
		);
		expect(onLink).toHaveBeenLastCalledWith(
			"https://bsky.app/profile/ana.bsky.social",
			"@ana.bsky.social",
		);
		const modified = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			metaKey: true,
		});
		const anchor = links[0];
		anchor?.addEventListener("click", (event) => event.preventDefault(), {
			once: true,
		});
		anchor?.dispatchEvent(modified);
		expect(onLink).toHaveBeenCalledTimes(2);
	});
});

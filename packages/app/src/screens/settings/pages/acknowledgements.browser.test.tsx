import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { setBlueskyClient } from "../../../data/bluesky-client";
import generated from "../acknowledgements.generated.json";
import AcknowledgementsPage from "./acknowledgements";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

const LOUIS_PROFILE = "/profile/did:plc:w64dlsa4zwjv2wljlvmymldc";

const contributorLink = () =>
	document.querySelector<HTMLAnchorElement>('a[data-contributor="lou.gg"]')
		?.href;

const libraryRows = () =>
	document.querySelectorAll<HTMLElement>("[data-library]");

it("opens contributors in the preferred Bluesky client", async () => {
	const { store } = await mountPage(() => (
		<AcknowledgementsPage platform="mobile" />
	));
	await expect.poll(contributorLink).toBe(`https://bsky.app${LOUIS_PROFILE}`);
	setBlueskyClient(store.preferences, "deer");
	await expect
		.poll(contributorLink)
		.toBe(`https://deer.social${LOUIS_PROFILE}`);
	expect(
		document.querySelector('[data-contributor="Matthew Justice"]')?.tagName,
	).toBe("DIV");
	expect(
		[...document.querySelectorAll<HTMLElement>("[data-contributor]")].map(
			(row) => row.dataset.contributor,
		),
	).toEqual([
		"felixs.dev",
		"omixann.me",
		"kyanoxia.com",
		"lou.gg",
		"Matthew Justice",
		"otterlord.dev",
		"rman.dev",
	]);
	expect(document.querySelectorAll("[data-contributor-role]")).toHaveLength(3);
});

it("virtualizes the generated library list and filters it by search", async () => {
	await mountPage(() => <AcknowledgementsPage platform="desktop" />, {
		width: 1200,
		height: 900,
	});
	await expect.poll(() => libraryRows().length).toBeGreaterThan(0);
	expect(libraryRows().length).toBeLessThan(generated.libraries.length);
	await userEvent.fill(
		page.getByRole("searchbox", { name: "Search libraries" }),
		"solid-js",
	);
	await expect
		.poll(() => [...libraryRows()].map((row) => row.dataset.library))
		.toContain("solid-js");
	for (const row of libraryRows())
		expect(row.dataset.library).toContain("solid-js");
});

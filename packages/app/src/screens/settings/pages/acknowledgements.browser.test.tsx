import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { setBlueskyClient } from "../../../data/bluesky-client";
import generated from "../acknowledgements.generated.json";
import AcknowledgementsPage, {
	loadContributorAvatar,
} from "./acknowledgements";
import { cleanup, mountPage } from "./page-test-kit";

const LOUIS_DID = "did:plc:w64dlsa4zwjv2wljlvmymldc";
const LOUIS_PDS = "https://pds.example.com";
const LOUIS_AVATAR_CID = "bafkreiavatar";

const respond = (body: unknown, status = 200) =>
	Promise.resolve(new Response(JSON.stringify(body), { status }));

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
	fetchSpy.mockImplementation((input) => {
		const url = String(input instanceof Request ? input.url : input);
		if (url === `https://plc.directory/${LOUIS_DID}`)
			return respond({
				service: [
					{
						id: "#atproto_pds",
						type: "AtprotoPersonalDataServer",
						serviceEndpoint: LOUIS_PDS,
					},
				],
			});
		if (url.startsWith(`${LOUIS_PDS}/xrpc/com.atproto.repo.getRecord?`))
			return respond({
				value: { avatar: { ref: { $link: LOUIS_AVATAR_CID } } },
			});
		return respond({ error: "NotFound" }, 404);
	});
});

afterEach(() => {
	cleanup();
	fetchSpy.mockReset();
});

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
		"clxxiii.dev",
		"felixs.dev",
		"omixann.me",
		"kyanoxia.com",
		"lou.gg",
		"Matthew Justice",
		"otterlord.dev",
		"rman.dev",
	]);
	expect(document.querySelectorAll("[data-contributor-role]")).toHaveLength(4);
});

it("loads contributor avatars from their own server when Colibri has none", async () => {
	const { store } = await mountPage(() => (
		<AcknowledgementsPage platform="mobile" />
	));
	expect(
		await loadContributorAvatar(store, { name: "Louis", did: LOUIS_DID }),
	).toBe(
		`${LOUIS_PDS}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(LOUIS_DID)}&cid=${LOUIS_AVATAR_CID}`,
	);
	expect(
		await loadContributorAvatar(store, {
			name: "Felix",
			did: "did:plc:pbjvqaziagcyv2vqodldn5op",
		}),
	).toBeUndefined();
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

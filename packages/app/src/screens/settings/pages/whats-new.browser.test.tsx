import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { ReleaseNoteSummary } from "../../../data/release-notes";
import { cleanup, mountPage } from "./page-test-kit";
import WhatsNewPage from "./whats-new";

const NOTES: ReleaseNoteSummary[] = [
	{
		version: "0.8.0",
		date: "November 20, 2026",
		title: "Fresh paint",
		entries: [
			{
				title: "A new look",
				body: "Everything got a new design.",
				icon: "palette",
				kind: "feature",
			},
			{
				title: "Locked channels",
				body: "Channels can be private.",
				icon: "lock-keyhole",
				kind: "feature",
			},
			{
				title: "Unknown icon",
				body: "This entry names an icon that does not exist.",
				icon: "not-an-icon",
				kind: "fix",
			},
		],
	},
];

afterEach(cleanup);

const iconOf = (title: string) => {
	const item = [
		...document.querySelectorAll<HTMLElement>("[data-release-note-item]"),
	].find((entry) => entry.textContent?.includes(title));
	return item?.querySelector("svg")?.getAttribute("class") ?? "";
};

it("links the full release history", async () => {
	await mountPage(() => <WhatsNewPage platform="desktop" notes={NOTES} />, {
		width: 1200,
		height: 900,
	});
	await expect.element(page.getByText("Fresh paint")).toBeVisible();
	const history = document.querySelector<HTMLAnchorElement>(
		'a[href*="github.com/colibri-social/colibri.social/releases"]',
	);
	expect(history).not.toBeNull();
});

it("shows each entry with its own icon", async () => {
	await mountPage(() => <WhatsNewPage platform="mobile" notes={NOTES} />);
	await expect.element(page.getByText("A new look")).toBeVisible();
	expect(iconOf("A new look")).toContain("solar-palette-bold");
	expect(iconOf("Locked channels")).toContain("solar-lock-keyhole-bold");
	expect(iconOf("Unknown icon")).toContain("solar-stars-bold");
});

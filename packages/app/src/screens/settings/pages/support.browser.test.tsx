import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { SupporterLinkTransport } from "../../../data/supporter-link";
import { cleanup, mountPage } from "./page-test-kit";
import SupportPage, { LINKING_UNAVAILABLE } from "./support";

const respond = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("plc.directory"))
				return respond({
					service: [
						{
							id: "#atproto_pds",
							type: "AtprotoPersonalDataServer",
							serviceEndpoint: "https://labeler-pds.example",
						},
					],
				});
			return respond({ error: "RecordNotFound" }, 400);
		}),
	);
});

it("offers the tiers and explains when linking isn't available", async () => {
	const { store } = await mountPage(() => <SupportPage platform="mobile" />);
	store.source.supporterLink = undefined;
	const connect = page.getByRole("button", { name: "Connect Open Collective" });
	await expect.element(connect).toBeVisible();
	expect(document.querySelectorAll("[data-support-tier]")).toHaveLength(3);
	await userEvent.click(connect);
	await expect
		.element(page.getByText(LINKING_UNAVAILABLE, { exact: true }))
		.toBeVisible();
});

const withTransport = async (transport: SupporterLinkTransport) => {
	const { store } = await mountPage(() => <SupportPage platform="mobile" />);
	store.source.supporterLink = transport;
	return store;
};

it("tells the viewer when Open Collective can't be opened", async () => {
	const start = vi.fn(async () => {
		throw new Error("offline");
	});
	await withTransport({ start, unlink: vi.fn() });
	await userEvent.click(
		page.getByRole("button", { name: "Connect Open Collective" }),
	);
	await expect
		.element(
			page
				.getByText("Couldn't open Open Collective. Try again.", { exact: true })
				.first(),
		)
		.toBeVisible();
	expect(start).toHaveBeenCalledOnce();
});

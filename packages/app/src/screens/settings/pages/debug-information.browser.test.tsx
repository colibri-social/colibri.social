import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import DebugInformationPage from "./debug-information";
import { cleanup, mountPage } from "./page-test-kit";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("{}", { status: 404 })),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("gathers diagnostics for the signed-in account", async () => {
	const { store } = await mountPage(() => (
		<DebugInformationPage platform="desktop" />
	));
	await expect
		.element(page.getByText(store.viewer.did, { exact: true }))
		.toBeVisible();
	await expect.element(page.getByText("Account and services")).toBeVisible();
	await expect
		.element(page.getByRole("button", { name: "Copy debug information" }))
		.toBeEnabled();
});

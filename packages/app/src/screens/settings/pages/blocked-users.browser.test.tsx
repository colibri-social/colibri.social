import { BLOCKED_USERS_COPY } from "@colibri-social/ui";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { didFor } from "../../../data/mock/people";
import type { Did } from "../../../data/types";
import BlockedUsersPage from "./blocked-users";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

const UNKNOWN = "did:plc:nobodyknowsthisperson0" as Did;

it("lists blocked people with their profile and unblocks them", async () => {
	const { store } = await mountPage(() => (
		<BlockedUsersPage platform="mobile" />
	));

	await expect
		.element(page.getByText(BLOCKED_USERS_COPY.empty, { exact: true }))
		.toBeVisible();

	await store.preferences.setBlocked(didFor("noor"), true);
	await store.preferences.setBlocked(UNKNOWN, true);

	await expect
		.element(page.getByText("Noor Haddad", { exact: true }))
		.toBeVisible();
	await expect.element(page.getByText("@noor.haddad.me")).toBeVisible();
	await expect
		.element(page.getByText(UNKNOWN, { exact: true }).last())
		.toBeVisible();
	expect(document.body.textContent).toMatch(/Blocked (now|\d+ \w+ ago)/);

	await userEvent.click(
		page.getByRole("button", {
			name: BLOCKED_USERS_COPY.unblockLabel("Noor Haddad"),
		}),
	);

	await expect
		.element(page.getByText("Noor Haddad", { exact: true }))
		.not.toBeInTheDocument();
	expect(store.preferences.isBlocked(didFor("noor"))).toBe(false);
	expect(store.preferences.isBlocked(UNKNOWN)).toBe(true);
});

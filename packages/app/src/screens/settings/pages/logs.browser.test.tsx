import {
	createLogger,
	isVerboseLogging,
	setVerboseLogging,
} from "@colibri-social/lib";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import LogsPage from "./logs";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(() => {
	cleanup();
	setVerboseLogging(false);
});

it("shows new log lines and switches detailed logging", async () => {
	await mountPage(() => <LogsPage platform="mobile" />);
	createLogger("settings-test").warn("the page sees this line");
	await expect
		.element(page.getByText("the page sees this line", { exact: false }))
		.toBeVisible();
	await userEvent.click(page.getByText("Detailed logging"));
	await expect.poll(() => isVerboseLogging()).toBe(true);
});

import { STORAGE_NOTICE_COPY } from "@colibri-social/ui";
import { createRoot } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createHostMode } from "../../data/polyfill/host-mode";
import type { Transport } from "../../data/remote/transport";
import { AccountStorageNotice } from "./storage-notice";

const disposers: Array<() => void> = [];

afterEach(() => {
	for (const dispose of disposers.splice(0)) dispose();
	document.body.replaceChildren();
});

const mount = () => {
	const host = createRoot((dispose) => {
		disposers.push(dispose);

		return createHostMode({ transport: {} as Transport, publish: true });
	});
	const container = document.createElement("div");

	document.body.append(container);
	disposers.push(host.dispose);
	disposers.push(render(() => <AccountStorageNotice />, container));

	return host;
};

describe("account storage notice", () => {
	it("stays hidden until the status is known and while native", async () => {
		const host = mount();

		expect(document.querySelector("[data-storage-notice]")).toBeNull();

		host.apply({ mode: "native", pdsSupportsSpaces: true });

		expect(document.querySelector("[data-storage-notice]")).toBeNull();
	});

	it("tells the user Colibri is keeping their messages", async () => {
		const host = mount();

		host.apply({ mode: "polyfill", pdsSupportsSpaces: false });

		await expect
			.element(page.getByRole("status"))
			.toHaveTextContent(STORAGE_NOTICE_COPY.hosted.title);
		expect(page.getByRole("progressbar").query()).toBeNull();
	});

	it("shows progress while moving and hides once done", async () => {
		const host = mount();

		host.apply({
			mode: "migrating",
			pdsSupportsSpaces: true,
			migration: { spacesTotal: 4, spacesDone: 1 },
		});

		await expect
			.element(page.getByRole("status"))
			.toHaveTextContent(STORAGE_NOTICE_COPY.moving.title);
		await expect
			.element(page.getByRole("progressbar"))
			.toHaveAttribute("aria-valuenow", "25");

		host.apply({ mode: "native", pdsSupportsSpaces: true });

		await expect
			.poll(() => document.querySelector("[data-storage-notice]"))
			.toBeNull();
	});
});

import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource } from "../../data/mock/source";
import type { ProfileSetup } from "../../data/source";
import { createDataStore, type DataStore } from "../../data/store";
import { Providers } from "../../providers";
import { ProfileGate, profileCompleteKey } from "./ProfileGate";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let store: DataStore | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	host?.remove();
	host = undefined;
	if (store) localStorage.removeItem(profileCompleteKey(store.viewer.did));
	store?.dispose();
	store = undefined;
});

const mount = (setup: () => Promise<ProfileSetup>) => {
	const source = createMockSource({ live: false });
	source.loadProfileSetup = setup;
	const putProfile = vi.fn(source.putProfile);
	source.putProfile = putProfile;
	const current = createDataStore(source);
	store = current;
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	dispose = render(
		() => (
			<Providers>
				<ProfileGate store={current}>
					<div data-test-app="">app</div>
				</ProfileGate>
			</Providers>
		),
		host,
	);
	return { putProfile, store: current };
};

const app = () => document.querySelector("[data-test-app]");
const welcome = () =>
	document.querySelector('[data-onboarding-screen="welcome"]');
const screen = (name: string) =>
	document.querySelector(`[data-onboarding-screen="${name}"]`);
const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>("button")].find(
		(element) => element.textContent?.trim() === name && !element.disabled,
	);

it("walks a new account through setup and writes the profile", async () => {
	const { putProfile, store: current } = mount(async () => ({
		complete: false,
	}));

	await until(() => welcome() !== null);
	expect(app()).toBeNull();
	expect(screen("sign-in")).toBeNull();
	await userEvent.click(page.getByRole("button", { name: "Start setup" }));

	await until(() => screen("profile-editor") !== null);
	await userEvent.click(page.getByRole("button", { name: "Back" }));
	await until(() => welcome() !== null);
	await userEvent.click(page.getByRole("button", { name: "Start setup" }));
	await until(() => screen("profile-editor") !== null);
	await userEvent.fill(
		page.getByRole("textbox", { name: "Display name" }),
		"Ada",
	);
	await userEvent.click(button("Next") as HTMLButtonElement);

	await until(() => screen("notifications") !== null);
	await userEvent.click(button("Skip") as HTMLButtonElement);

	await until(() => app() !== null);
	expect(putProfile).toHaveBeenCalledTimes(1);
	expect(putProfile.mock.calls[0]?.[0]).toMatchObject({
		displayName: "Ada",
		pronouns: "",
		syncBluesky: false,
	});
	expect(putProfile.mock.calls[0]?.[0].avatar).toBeTruthy();
	expect(localStorage.getItem(profileCompleteKey(current.viewer.did))).toBe(
		"1",
	);
});

it("prefills the editor from an existing Colibri profile", async () => {
	mount(async () => ({
		complete: false,
		colibri: { displayName: "Old name", pronouns: "she/her" },
	}));

	await until(() => welcome() !== null);
	await userEvent.click(page.getByRole("button", { name: "Start setup" }));
	await until(() => screen("profile-source") !== null);
	const existing = document.querySelector<HTMLInputElement>(
		"input[type='radio'][value='existing']",
	);
	expect(existing?.checked).toBe(true);
	await userEvent.click(button("Next") as HTMLButtonElement);

	await until(() => screen("profile-editor") !== null);
	const values = [
		...document.querySelectorAll<HTMLInputElement>(
			"[data-onboarding-screen='profile-editor'] input",
		),
	].map((input) => input.value);
	expect(values).toContain("Old name");
	expect(values).toContain("she/her");
});

it("shows the app at once for an account it already checked", async () => {
	const source = createMockSource({ live: false });
	localStorage.setItem(profileCompleteKey(source.viewer().did), "1");
	mount(() => new Promise<ProfileSetup>(() => {}));

	await until(() => app() !== null, 1000);
	expect(screen("profile-editor")).toBeNull();
});

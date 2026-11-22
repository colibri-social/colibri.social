import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { displayNameOf } from "../../data/adapters/authors";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { ProfileSheetProvider, useProfileSheet } from "./profile-sheet";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();

	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;

afterEach(() => {
	stop?.();
	stop = undefined;
	document.body.replaceChildren();
});

const button = (name: string) => {
	return Array.from(document.querySelectorAll<HTMLElement>("button")).find(
		(element) => element.textContent?.trim() === name,
	);
};

const mount = async () => {
	setLatency(0);
	await page.viewport(402, 874);

	const store = createDataStore(createMockSource({ live: false }));

	await until(() => !!store.communities.value());

	const hq = store.spaceByKey(HQ);

	if (!hq) throw new Error("hq missing");

	const space = store.space(hq);

	await until(() => !!space.members.value());

	const other = space.members
		.value()
		?.find((member) => member.actor.did !== store.viewer.did);

	if (!other) throw new Error("no other member");

	let open: ReturnType<typeof useProfileSheet>["open"] = () => {};
	const Capture = () => {
		open = useProfileSheet().open;
		return null;
	};
	const host = document.createElement("div");

	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<ProfileSheetProvider>
						<Capture />
					</ProfileSheetProvider>
				</Providers>
			</DataContext.Provider>
		),
		host,
	);

	return {
		store,
		other,
		name: displayNameOf(other.actor),
		open: (did: string) => open(did, HQ),
	};
};

const notice = () => {
	return document.querySelector<HTMLElement>("[data-blocked-profile-notice]");
};

const hiddenContent = () => {
	return document.querySelector<HTMLElement>(
		"[data-blocked-profile-hidden] > [inert]",
	);
};

it("blocks from another member's profile and leaves the viewer's own alone", async () => {
	const { store, other, name, open } = await mount();

	open(other.actor.did);
	await until(() => !!button(`Block ${name}`));
	button(`Block ${name}`)?.click();
	await until(() => !!button("Block"));
	button("Block")?.click();
	await until(() => store.preferences.isBlocked(other.actor.did));

	open(other.actor.did);
	await until(() => !!button("Show profile"));
	button("Show profile")?.click();
	await until(() => !notice());
	button(`Unblock ${name}`)?.click();
	await until(() => !store.preferences.isBlocked(other.actor.did));

	open(store.viewer.did);
	await until(() => !!document.querySelector('[role="dialog"]'));
	await new Promise((resolve) => setTimeout(resolve, 300));

	expect(
		Array.from(document.querySelectorAll("button")).some((element) =>
			/^(Block|Unblock) /.test(element.textContent?.trim() ?? ""),
		),
	).toBe(false);
	expect(notice()).toBeNull();
});

it("hides a blocked profile behind a notice until shown or unblocked", async () => {
	const { store, other, name, open } = await mount();

	await store.preferences.setBlocked(other.actor.did, true);
	open(other.actor.did);
	await until(() => !!notice());

	const content = hiddenContent();

	expect(content?.getAttribute("aria-hidden")).toBe("true");
	expect(content?.textContent).toContain(name);
	expect(notice()?.textContent).toContain("You blocked this person");

	button("Show profile")?.click();
	await until(() => !notice());

	expect(hiddenContent()).toBeNull();
	expect(button(`Unblock ${name}`)).toBeDefined();
	expect(store.preferences.isBlocked(other.actor.did)).toBe(true);

	const dialog = document.querySelector('[role="dialog"]');

	expect(dialog?.contains(document.activeElement)).toBe(true);

	await userEvent.keyboard("{Escape}");
	await until(() => !document.querySelector('[role="dialog"]'));
	open(other.actor.did);
	await until(() => !!notice());
	button("Unblock")?.click();
	await until(() => !store.preferences.isBlocked(other.actor.did));
	await until(() => !notice());

	expect(document.querySelector("[data-blocked-profile]")).toBeNull();
	expect(button(`Block ${name}`)).toBeDefined();
});

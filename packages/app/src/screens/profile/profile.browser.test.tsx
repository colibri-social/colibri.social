import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import "../../app.css";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;

afterEach(async () => {
	stop?.();
	stop = undefined;
	document.body.innerHTML = "";
	await wait(50);
});

const mount = async (path: string) => {
	setLatency(0);
	window.history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { store, host };
};

const buttons = (root: ParentNode = document) =>
	Array.from(root.querySelectorAll<HTMLElement>("button"));

const button = (name: string | RegExp, root: ParentNode = document) =>
	buttons(root).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const dialog = (title: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => element.textContent?.includes(title),
	);

const type = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	field.focus();
	field.value = value;
	field.dispatchEvent(new InputEvent("input", { bubbles: true }));
};

const fieldByLabel = (label: string) => {
	const element = Array.from(document.querySelectorAll("label")).find((entry) =>
		entry.textContent?.trim().startsWith(label),
	);
	const id = element?.getAttribute("for");
	return (id ? document.getElementById(id) : null) as
		| HTMLInputElement
		| HTMLTextAreaElement
		| null;
};

const openEditor = async () => {
	await until(() => !!button("Edit profile"));
	button("Edit profile")?.click();
	await until(() => window.location.pathname === "/app/profile/edit");
	await until(() => !!fieldByLabel("Display name"));
};

const hqMemberActor = async (store: DataStore) => {
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq."));
	if (!hq) throw new Error("hq missing");
	const space = store.space(hq);
	await until(() => !!space.members.value());
	return () => space.memberByDid(store.viewer.did)?.actor;
};

describe("profile tab", () => {
	it("saves name, bio and accent and shows them everywhere", async () => {
		const { store } = await mount("/app/profile");
		const actor = await hqMemberActor(store);
		await openEditor();
		const name = fieldByLabel("Display name") as HTMLInputElement;
		const bio = fieldByLabel("Bio") as HTMLTextAreaElement;
		type(name, "Lou the Builder");
		type(bio, "Writes the new client in the open.");
		button(/^Name color,/)?.click();
		await until(() => !!document.querySelector("[data-color-preset]"));
		const preset = Array.from(
			document.querySelectorAll<HTMLElement>("[data-color-preset]"),
		).find((element) => element.getAttribute("aria-pressed") !== "true");
		const color = preset?.dataset.colorPreset;
		preset?.click();
		document.activeElement?.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
		await wait(300);
		button("Save")?.click();
		await until(() => window.location.pathname === "/app/profile");
		expect(store.viewer.displayName).toBe("Lou the Builder");
		expect(store.viewer.description).toBe("Writes the new client in the open.");
		expect(store.viewer.theme?.accentColor).toBe(color);
		expect(actor()?.displayName).toBe("Lou the Builder");
		expect(actor()?.theme?.accentColor).toBe(color);
		await until(
			() =>
				document.querySelector("[data-profile-name]")?.textContent ===
				"Lou the Builder",
		);
		expect(document.body.textContent).toContain(
			"Writes the new client in the open.",
		);
	});

	it("sets and clears the status", async () => {
		const { store } = await mount("/app/profile");
		await until(() => !!button(/^(Edit status|Set a status)$/));
		button(/^(Edit status|Set a status)$/)?.click();
		await until(() => !!dialog("Set your status"));
		const sheet = dialog("Set your status") as HTMLElement;
		const input = sheet.querySelector<HTMLInputElement>("input[type=text]");
		if (!input) throw new Error("status input missing");
		type(input, "Shipping the profile editor before the weekend 🚀");
		await wait(400);
		await expectNoLayoutIssues(sheet);
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
		await until(() => !!dialog("Discard changes?"));
		const prompt = dialog("Discard changes?") as HTMLElement;
		expect(prompt.textContent).toContain("Your new status won't be saved.");
		button("Cancel", prompt)?.click();
		await until(() => !dialog("Discard changes?"));
		expect(dialog("Set your status")).toBe(sheet);
		expect(input.value).toBe(
			"Shipping the profile editor before the weekend 🚀",
		);
		button("Save", sheet)?.click();
		await until(
			() =>
				store.presenceOf(store.viewer.did)?.status?.text ===
				"Shipping the profile editor before the weekend 🚀",
		);
		await until(() => !dialog("Set your status"));
		await until(() => !!document.querySelector("[data-status-bubble]"));
		button("Edit status")?.click();
		await until(() => !!dialog("Set your status"));
		button("Remove status")?.click();
		await until(() => !store.presenceOf(store.viewer.did)?.status);
		await until(() => !dialog("Set your status"));
		await until(() => !!button("Set a status"));
	});

	it("opens the editor as a layer and guards unsaved changes on back", async () => {
		await mount("/app/profile");
		await openEditor();
		window.history.back();
		await until(() => window.location.pathname === "/app/profile");
		await openEditor();
		type(fieldByLabel("Display name") as HTMLInputElement, "Someone else");
		document.activeElement instanceof HTMLElement &&
			document.activeElement.blur();
		window.history.back();
		await until(() => !!dialog("Discard changes?"));
		await wait(400);
		expect(window.location.pathname).toBe("/app/profile/edit");
		await expectNoLayoutIssues(dialog("Discard changes?") as HTMLElement);
		button("Cancel")?.click();
		await until(() => !dialog("Discard changes?"));
		expect((fieldByLabel("Display name") as HTMLInputElement).value).toBe(
			"Someone else",
		);
		button(/^Back$|^Go back$/)?.click();
		await until(() => !!dialog("Discard changes?"));
		button("Discard changes")?.click();
		await until(() => window.location.pathname === "/app/profile");
	});

	it("keeps long profile content inside the editor", async () => {
		const { store } = await mount("/app/profile/edit");
		await until(() => !!fieldByLabel("Display name"));
		type(
			fieldByLabel("Display name") as HTMLInputElement,
			"Wolfeschlegelsteinhausenbergerdorff",
		);
		type(
			fieldByLabel("Bio") as HTMLTextAreaElement,
			"A very long bio that keeps going and going to check that the text area grows and nothing spills outside the editor. ".repeat(
				2,
			),
		);
		await wait(300);
		const layer = document.querySelector<HTMLElement>(
			'[data-pane-index="1"] > div:last-child',
		);
		if (!layer) throw new Error("editor layer missing");
		await expectNoLayoutIssues(layer);
		expect(store.viewer.displayName).not.toBe(
			"Wolfeschlegelsteinhausenbergerdorff",
		);
	});
});

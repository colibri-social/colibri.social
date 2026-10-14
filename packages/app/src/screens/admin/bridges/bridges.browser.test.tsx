import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	host = document.createElement("div");
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
	await until(() => !store.communities.loading());
	return { store, source, root: host };
};

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const typeInto = (
	input: HTMLInputElement | HTMLTextAreaElement,
	value: string,
) => {
	input.value = value;
	input.dispatchEvent(new InputEvent("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const fieldLabelled = (scope: ParentNode, label: string) => {
	const element = Array.from(scope.querySelectorAll("label")).find((entry) =>
		entry.textContent?.trim().startsWith(label),
	);
	const id = element?.getAttribute("for");
	return (
		id ? document.getElementById(id) : element?.querySelector("input, textarea")
	) as HTMLInputElement | HTMLTextAreaElement;
};

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const page = (root: HTMLElement, name: string) =>
	root.querySelector<HTMLElement>(`[data-admin-${name}]`);

const dialogNamed = (name: string | RegExp) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => {
			const text =
				element.getAttribute("aria-label") ?? element.textContent ?? "";
			return typeof name === "string" ? text.includes(name) : name.test(text);
		},
	);

describe("bridges", () => {
	it("lists connected bridges and connects a featured bridge with a code", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/bridges`);
		await until(() => !!page(root, "bridges"));
		const list = page(root, "bridges") as HTMLElement;
		await until(() => !!list.querySelector("[data-bridge-list]"));
		expect(list.textContent).toContain("Bridges sync Colibri channels");
		expect(list.textContent).toContain("Libera Chat");
		const before = store.directory.bridges(HQ).registrations()?.length ?? 0;
		buttonNamed(list, "New bridge")?.click();
		await until(() => !!page(root, "bridge-new"));
		const featured = page(root, "bridge-new") as HTMLElement;
		expect(featured.textContent).toContain("Featured Bridges");
		await wait(400);
		expect(layoutIssues(featured)).toEqual([]);
		buttonNamed(featured, "Connect Matrix")?.click();
		await until(() => !!page(root, "bridge-connect"));
		const connect = page(root, "bridge-connect") as HTMLElement;
		expect(connect.textContent).toContain("Invite the Colibri bridge");
		expect(connect.querySelectorAll("ol > li")).toHaveLength(3);
		const submit = buttonNamed(connect, "Connect") as HTMLButtonElement;
		expect(submit.disabled).toBe(true);
		const field = connect.querySelector<HTMLInputElement>(
			'input[aria-label="Pairing code"]',
		) as HTMLInputElement;
		typeInto(field, "nope");
		await until(() => !submit.disabled);
		submit.click();
		await until(() => (connect.textContent ?? "").includes("didn't work"));
		typeInto(field, "MTRX2345");
		await until(() => !submit.disabled);
		submit.click();
		await until(() => !!dialogNamed(/^Connect /));
		const confirm = dialogNamed(/^Connect /) as HTMLElement;
		buttonNamed(confirm, "Connect")?.click();
		await until(() => !!page(root, "bridge"), 6000);
		await until(() => /\/manage\/bridge\/[^/]+$/.test(location.pathname));
		expect(store.directory.bridges(HQ).registrations()?.length).toBe(
			before + 1,
		);
		history.back();
		await until(() => location.pathname === `/app/c/${HQ}/manage/bridges`);
	});

	it("connects with a code from the I have a code page", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/bridge-new`);
		await until(() => !!page(root, "bridge-new"));
		buttonNamed(
			page(root, "bridge-new") as HTMLElement,
			"I have a code",
		)?.click();
		await until(() => !!page(root, "bridge-code"));
		const view = page(root, "bridge-code") as HTMLElement;
		const connect = buttonNamed(view, "Connect") as HTMLButtonElement;
		expect(connect.disabled).toBe(true);
		typeInto(fieldLabelled(view, "Pairing Code"), "TELE2345");
		await until(() => !connect.disabled);
		connect.click();
		await until(() => !!dialogNamed(/^Connect /));
		buttonNamed(dialogNamed(/^Connect /) as HTMLElement, "Connect")?.click();
		await until(() => !!page(root, "bridge"), 6000);
	});

	it("asks before dropping a typed pairing code", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/bridge-new`);
		await until(() => !!page(root, "bridge-new"));
		buttonNamed(
			page(root, "bridge-new") as HTMLElement,
			"I have a code",
		)?.click();
		await until(() => !!page(root, "bridge-code"));
		const view = page(root, "bridge-code") as HTMLElement;
		typeInto(fieldLabelled(view, "Pairing Code"), "TELE2345");
		await wait(300);
		buttonNamed(view, "Back to New Bridge")?.click();
		await until(() => !!dialogNamed("Discard changes?"));
		expect(dialogNamed("Discard changes?")?.textContent).toContain(
			"The bridge won't be connected.",
		);
		await wait(300);
		buttonNamed(
			dialogNamed("Discard changes?") as HTMLElement,
			"Cancel",
		)?.click();
		await until(() => !dialogNamed("Discard changes?"));
		expect(page(root, "bridge-code")).not.toBeNull();
		buttonNamed(view, "Back to New Bridge")?.click();
		await until(() => !!dialogNamed("Discard changes?"));
		await wait(300);
		buttonNamed(
			dialogNamed("Discard changes?") as HTMLElement,
			"Discard changes",
		)?.click();
		await until(() => location.pathname.endsWith("/manage/bridge-new"));
	});
});

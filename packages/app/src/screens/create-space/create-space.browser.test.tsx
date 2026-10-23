import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutIssues } from "../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
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

const screen = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-create-space]");

describe("create a Space", () => {
	it("creates a Space from the rail and opens it with the starter layout", async () => {
		const { root, store } = await mount("/app");
		await until(() => !!buttonNamed(root, "Create a Space"));
		buttonNamed(root, "Create a Space")?.click();
		await until(() => location.pathname === "/app/new" && !!screen(root));
		const view = screen(root) as HTMLElement;
		expect(view.textContent).toContain("Create your Space");
		const create = buttonNamed(view, "Create Space") as HTMLButtonElement;
		expect(create.disabled).toBe(true);
		typeInto(
			fieldLabelled(view, "Space name"),
			"A Space with a name that is long",
		);
		expect(fieldLabelled(view, "Description")).toBeFalsy();
		expect(buttonNamed(view, "Add banner")).toBeUndefined();
		await wait(400);
		expect(
			layoutIssues(view).filter(
				(issue) => !issue.element.includes("Space icon"),
			),
		).toEqual([]);
		await until(() => !create.disabled);
		create.click();
		await until(() => location.pathname.startsWith("/app/c/did:plc:"), 6000);
		const did = location.pathname.split("/")[3] ?? "";
		const created = store.spaceByKey(did);
		expect(created?.name).toBe("A Space with a name that is long");
		expect(created?.viewer.isOwner).toBe(true);
		await until(() =>
			Array.from(root.querySelectorAll("[data-space-rail] button")).some(
				(element) =>
					element.textContent?.includes("A Space with a name that is long"),
			),
		);
		await until(() => !!buttonNamed(root, /^general/));
		expect(root.textContent).toContain("Text channels");
		expect(root.textContent).toContain("Voice channels");
	});

	it("keeps the form when creating fails", async () => {
		const { root, store } = await mount("/app/new");
		await until(() => !!screen(root));
		const view = screen(root) as HTMLElement;
		const before = store.communities.value()?.length ?? 0;
		typeInto(fieldLabelled(view, "Space name"), "This will fail");
		await wait(50);
		buttonNamed(view, "Create Space")?.click();
		await until(() =>
			(document.body.textContent ?? "").includes("couldn't create the Space"),
		);
		expect(location.pathname).toBe("/app/new");
		expect(fieldLabelled(view, "Space name").value).toBe("This will fail");
		expect(store.communities.value()?.length).toBe(before);
	});

	const useOwnAccount = async (view: HTMLElement, account: string) => {
		buttonNamed(view, "Change who hosts this Space")?.click();
		await until(() =>
			(document.body.textContent ?? "").includes("Use an account I own"),
		);
		await until(
			() => !!document.querySelector("input[type='radio'][value='own']"),
		);
		document
			.querySelector<HTMLInputElement>("input[type='radio'][value='own']")
			?.click();
		await until(() => !!fieldLabelled(view, "Account"));
		await wait(400);
		typeInto(fieldLabelled(view, "Account"), account);
	};

	it("creates a Space on an account the viewer owns", async () => {
		const opened: string[] = [];
		const open = window.open;
		window.open = ((url?: string | URL) => {
			opened.push(String(url));
			return null;
		}) as typeof window.open;
		try {
			const { root, store } = await mount("/app/new");
			await until(() => !!screen(root));
			const view = screen(root) as HTMLElement;
			typeInto(fieldLabelled(view, "Space name"), "Night Owls");
			await useOwnAccount(view, "nightowls.example.com");
			buttonNamed(view, "Sign in and create")?.click();
			await until(() =>
				(root.textContent ?? "").includes("Waiting for you to sign in"),
			);
			expect(opened).toContain("about:blank");
			await until(() => location.pathname.startsWith("/app/c/did:plc:"), 8000);
			const did = location.pathname.split("/")[3] ?? "";
			expect(store.spaceByKey(did)?.name).toBe("Night Owls");
		} finally {
			window.open = open;
		}
	});

	it("explains a sign-in as the wrong account", async () => {
		const open = window.open;
		window.open = (() => null) as typeof window.open;
		try {
			const { root } = await mount("/app/new");
			await until(() => !!screen(root));
			const view = screen(root) as HTMLElement;
			typeInto(fieldLabelled(view, "Space name"), "Night Owls");
			await useOwnAccount(view, "wrong.example.com");
			buttonNamed(view, "Sign in and create")?.click();
			await until(
				() =>
					(root.textContent ?? "").includes(
						"You signed in as a different account",
					),
				8000,
			);
			expect(root.textContent).toContain("alex.example.com");
			buttonNamed(root, "Back")?.click();
			await until(
				() => !!fieldLabelled(screen(root) as HTMLElement, "Account"),
			);
			expect(
				fieldLabelled(screen(root) as HTMLElement, "Space name").value,
			).toBe("Night Owls");
		} finally {
			window.open = open;
		}
	});

	it("closes back to the Space list", async () => {
		const { root } = await mount("/app");
		await until(() => !!buttonNamed(root, "Create a Space"));
		buttonNamed(root, "Create a Space")?.click();
		await until(() => !!screen(root));
		await wait(400);
		buttonNamed(screen(root) as HTMLElement, "Close")?.click();
		await until(() => location.pathname !== "/app/new");
	});
});

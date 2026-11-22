import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

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

const mount = (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
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
	return host;
};

const typeInto = (input: HTMLInputElement, value: string) => {
	input.value = value;
	input.dispatchEvent(new InputEvent("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const activeScreen = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-pane][data-pane-active]") ??
	Array.from(root.querySelectorAll<HTMLElement>("[data-pane]")).at(-1) ??
	root;

const membersButton = (root: HTMLElement) =>
	Array.from(activeScreen(root).querySelectorAll<HTMLElement>("button")).find(
		(element) => /^Members/.test(element.textContent?.trim() ?? ""),
	);

const badgeIn = (root: ParentNode, scope: string, badge: string) =>
	!!root.querySelector(`${scope} [data-user-badge="${badge}"]`);

describe("member badges in admin screens", () => {
	it("shows the badge on members of a role", async () => {
		const root = mount(`/app/c/${HQ}/manage/role/testers`);
		await until(() => location.pathname.includes("/manage/role/testers"));
		await until(() => !!membersButton(root));
		membersButton(root)?.click();
		await until(() => badgeIn(root, "[data-member-identity]", "supporter-ten"));
	});

	it("shows the badge in the members list", async () => {
		const root = mount(`/app/c/${HQ}/manage/members`);
		await until(() => !!root.querySelector('input[type="search"]'));
		typeInto(
			root.querySelector('input[type="search"]') as HTMLInputElement,
			"noor",
		);
		await until(() =>
			badgeIn(root, "[data-member-action-row]", "play-store-tester"),
		);
	});

	it("shows the badge when picking a new owner", async () => {
		const root = mount(`/app/c/${HQ}/manage/transfer`);
		await until(() => !!root.querySelector('input[type="search"]'));
		typeInto(
			root.querySelector('input[type="search"]') as HTMLInputElement,
			"lena",
		);
		await until(() => badgeIn(root, '[role="radiogroup"]', "supporter-ten"));
	});
});

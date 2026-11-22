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

const mount = (path: string, store: DataStore) => {
	stop?.();
	document.body.innerHTML = "";
	window.history.replaceState(null, "", path);
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
	return host;
};

const presenceDialog = () =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => element.getAttribute("aria-label") === "Online status",
	);

const avatarButton = () =>
	document.querySelector<HTMLButtonElement>("button[data-profile-avatar]");

describe("presence picker", () => {
	it("sets your online status from the profile avatar", async () => {
		setLatency(0);
		const store = createDataStore(createMockSource({ live: false }));
		mount("/app/profile", store);
		await until(() => !!avatarButton());
		expect(avatarButton()?.getAttribute("aria-label")).toBe(
			"Change your online status, currently Online",
		);
		avatarButton()?.click();
		await until(() => !!presenceDialog());
		const dialog = presenceDialog() as HTMLElement;
		const options = Array.from(
			dialog.querySelectorAll<HTMLElement>('[role="radio"]'),
		);
		expect(options.map((option) => option.textContent?.trim())).toEqual([
			"Online",
			"Away",
			"Do not disturb",
			"Offline",
		]);
		await wait(400);
		await expectNoLayoutIssues(dialog);
		options[2]?.click();
		await until(() => !presenceDialog());
		await until(
			() =>
				avatarButton()?.getAttribute("aria-label") ===
				"Change your online status, currently Do not disturb",
		);
		expect(
			avatarButton()?.querySelector(
				'[role="img"][aria-label$=": Do not disturb"]',
			),
		).not.toBeNull();
		expect(store.presenceOf(store.viewer.did)?.onlineState).toBe("dnd");

		const name = store.viewer.displayName ?? store.viewer.handle;
		mount(
			"/app/c/did:plc:colibrihqspace2a4b6c8d/social.colibri.beta.channel.text/general/members",
			store,
		);
		const viewerRow = () =>
			Array.from(
				document.querySelectorAll<HTMLElement>("[data-member-row]"),
			).find((row) => row.textContent?.includes(name));
		await until(() => !!viewerRow(), 10000);
		expect(
			viewerRow()?.querySelector(
				'[role="img"][aria-label$=": Do not disturb"]',
			),
		).not.toBeNull();
	});
});

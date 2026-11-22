import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { spaceNotificationPrefs } from "../../data/notifications";
import { createDataStore, DataContext } from "../../data/store";
import { setVoiceSoundPlayer } from "../../data/voice";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const PIXEL = "did:plc:pixelgardenspace5n7p9q";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const mount = async (path: string) => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	await page.viewport(402, 874);
	await until(() => !matchMedia("(min-width: 768px)").matches);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return store;
};

const joinButton = () =>
	Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
		(button) => button.textContent?.trim() === "Join this Space",
	);

const muteSwitch = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>("[data-list-toggle-row]"),
	).find((row) => row.textContent?.includes("Mute this Space"));

it("mutes the Space on join when the toggle is on", async () => {
	const store = await mount("/app/invite/pixel-garden");
	await until(() => !!joinButton() && !!muteSwitch());
	const prefs = spaceNotificationPrefs(store);
	expect(prefs.isMuted(PIXEL)).toBe(false);
	(
		muteSwitch()?.querySelector('input[type="checkbox"]') as HTMLInputElement
	).click();
	joinButton()?.click();
	await until(() => prefs.isMuted(PIXEL));
});

it("leaves the Space unmuted when the toggle stays off", async () => {
	const store = await mount("/app/invite/pixel-garden");
	await until(() => !!joinButton() && !!muteSwitch());
	joinButton()?.click();
	await until(() => !joinButton() || !muteSwitch());
	expect(spaceNotificationPrefs(store).isMuted(PIXEL)).toBe(false);
});

import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
	PREFERENCES_STORAGE_KEY,
	setBlueskyClientPreference,
} from "../../data/bluesky-client";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { ProfileSheetProvider, useProfileSheet } from "./profile-sheet";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stops: (() => void)[] = [];

afterEach(() => {
	for (const stop of stops) stop();
	stops = [];
	document.body.replaceChildren();
	setBlueskyClientPreference("bluesky", "");
	localStorage.removeItem(PREFERENCES_STORAGE_KEY);
});

const host = (style: string) => {
	const element = document.createElement("div");
	element.style.cssText = style;
	document.body.append(element);
	return element;
};

const profileLink = (root: ParentNode = document) =>
	root.querySelector<HTMLAnchorElement>("[data-profile-link]");

describe("Bluesky profile link", () => {
	it("links another member's popover to the preferred client and follows changes", async () => {
		setLatency(0);
		await page.viewport(1440, 900);
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
		let anchor: HTMLButtonElement | undefined;
		const Capture = () => {
			open = useProfileSheet().open;
			return null;
		};
		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Providers>
							<ProfileSheetProvider>
								<Capture />
								<button type="button" ref={anchor} style={{ margin: "200px" }}>
									Anchor
								</button>
							</ProfileSheetProvider>
						</Providers>
					</DataContext.Provider>
				),
				host("position:fixed;inset:0;width:1440px;height:900px"),
			),
		);
		open(other.actor.did, HQ, { element: anchor });
		await until(() => !!profileLink());
		const link = profileLink() as HTMLAnchorElement;
		expect(link.getAttribute("href")).toBe(
			`https://bsky.app/profile/${other.actor.did}`,
		);
		expect(link.getAttribute("aria-label")).toBe("View on Bluesky");
		expect(link.querySelector("svg")?.getAttribute("data-bluesky-client")).toBe(
			"bluesky",
		);
		expect(link.getAttribute("target")).toBe("_blank");
		await expect
			.poll(() => {
				const box = link.getBoundingClientRect();
				return Math.min(box.width, box.height);
			})
			.toBeGreaterThanOrEqual(24);

		localStorage.setItem(
			PREFERENCES_STORAGE_KEY,
			JSON.stringify({ warnOnExternalLinks: false }),
		);
		setBlueskyClientPreference("mu");
		await until(
			() =>
				profileLink()?.getAttribute("href") ===
				`https://mu.social/profile/${other.actor.did}`,
		);
		expect(profileLink()?.getAttribute("aria-label")).toBe(
			"View on Mu Social",
		);
		expect(
			profileLink()?.querySelector("svg")?.getAttribute("data-bluesky-client"),
		).toBe("mu");
		expect(profileLink()?.style.getPropertyValue("--profile-link-tint")).toBe(
			"#db4aa6",
		);
		expect(
			JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}"),
		).toEqual({
			warnOnExternalLinks: false,
			preferredBlueskyClient: "mu",
			customBlueskyClientBase: "",
		});

		setBlueskyClientPreference("custom", "https://MyClient.app/");
		await until(
			() =>
				profileLink()?.getAttribute("href") ===
				`https://myclient.app/profile/${other.actor.did}`,
		);
		expect(profileLink()?.getAttribute("aria-label")).toBe(
			"View on myclient.app",
		);
		expect(profileLink()?.querySelector("[data-bluesky-client]")).toBeNull();
	});

	it("links your own full profile view", async () => {
		setLatency(0);
		await page.viewport(402, 874);
		window.history.replaceState(null, "", "/app/profile");
		const store = createDataStore(createMockSource({ live: false }));
		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Providers>
							<MobileShell />
						</Providers>
					</DataContext.Provider>
				),
				host("position:fixed;inset:0;width:402px;height:874px"),
			),
		);
		await until(() => !!profileLink());
		expect(profileLink()?.getAttribute("href")).toBe(
			`https://bsky.app/profile/${store.viewer.did}`,
		);
	});
});

import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { didFor } from "../../data/mock/people";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { ownProfileData } from "./own-profile";
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
});

const host = (style: string) => {
	const element = document.createElement("div");
	element.style.cssText = style;
	document.body.append(element);
	return element;
};

const bannerBackground = (root: ParentNode) =>
	root.querySelector<HTMLElement>("[data-banner-layer]")?.style.background ??
	"";

const fieldByLabel = (label: string) => {
	const element = Array.from(document.querySelectorAll("label")).find((entry) =>
		entry.textContent?.trim().startsWith(label),
	);
	const id = element?.getAttribute("for");
	return (id ? document.getElementById(id) : null) as HTMLInputElement | null;
};

const button = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			(element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
			name,
	);

const gradientSource = async () => {
	setLatency(0);
	const source = createMockSource({ live: false });
	await source.putProfile({
		syncBluesky: false,
		theme: {
			accentColor: "#a579ff",
			gradient: { primary: "#a579ff", secondary: "#4dd4c6" },
		},
	});
	return source;
};

describe("profile theme and pronouns", () => {
	it("shows a member's gradient and pronouns in their popover", async () => {
		setLatency(0);
		await page.viewport(1440, 900);
		const store = createDataStore(createMockSource({ live: false }));
		await until(() => !!store.communities.value());
		const hq = store.spaceByKey(HQ);
		if (!hq) throw new Error("hq missing");
		await until(() => !!store.space(hq).members.value());
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

		open(didFor("mira"), HQ, { element: anchor });
		await until(() => !!document.querySelector("[data-profile-popover]"));
		const popover = document.querySelector<HTMLElement>(
			"[data-profile-popover]",
		) as HTMLElement;
		await until(() => bannerBackground(popover).includes("gradient"));

		expect(bannerBackground(popover)).toContain("rgb(255, 143, 171)");
		expect(bannerBackground(popover)).toContain("rgb(124, 58, 237)");
		expect(popover.querySelector("[data-profile-pronouns]")?.textContent).toBe(
			"she/they, sie/ihr",
		);
	});

	it("feeds the own-user banner the profile gradient", async () => {
		const store = createDataStore(await gradientSource());
		let profile: ReturnType<typeof ownProfileData> | undefined;
		const Capture = () => {
			profile = ownProfileData(store, undefined);
			return null;
		};
		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Capture />
					</DataContext.Provider>
				),
				host("position:fixed;inset:0"),
			),
		);

		expect(profile?.bannerColor).toBe(
			"linear-gradient(135deg, #a579ff, #4dd4c6)",
		);
		expect(profile?.pronouns).toBe("he/him");
	});

	it("edits pronouns and shows them on the profile tab", async () => {
		setLatency(0);
		await page.viewport(402, 874);
		window.history.replaceState(null, "", "/app/profile");
		const store = createDataStore(await gradientSource());
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
		await until(() => !!document.querySelector("[data-profile-pronouns]"));
		expect(document.querySelector("[data-profile-pronouns]")?.textContent).toBe(
			"he/him",
		);
		expect(bannerBackground(document)).toContain("rgb(165, 121, 255)");

		await until(() => !!button("Edit profile"));
		button("Edit profile")?.click();
		await until(() => !!fieldByLabel("Pronouns"));
		const field = fieldByLabel("Pronouns") as HTMLInputElement;
		expect(field.value).toBe("he/him");
		field.focus();
		field.value = "they/them";
		field.dispatchEvent(new InputEvent("input", { bubbles: true }));
		await until(() => !!button("Save"));
		button("Save")?.click();
		await until(() => store.viewer.pronouns === "they/them");
		await until(
			() =>
				document.querySelector("[data-profile-pronouns]")?.textContent ===
				"they/them",
		);
	});
});

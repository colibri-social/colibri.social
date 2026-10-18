import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import "../../app.css";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { activityPromptKey } from "./activity-prompt";

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
	localStorage.clear();
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

const MEMBERS =
	"/app/c/did:plc:colibrihqspace2a4b6c8d/social.colibri.beta.channel.text/general/members";

const rowOf = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-member-row]")).find(
		(row) => row.querySelector("[data-member-name]")?.textContent === name,
	);

const storeWith = (
	detect?: (did: string) => Promise<"teal.fm" | null>,
): DataStore => {
	setLatency(0);
	const source = createMockSource({ live: false });
	if (detect) source.detectActivitySource = detect;
	return createDataStore(source);
};

describe("member list badges and activity", () => {
	it("shows labeler badges and the current activity line", async () => {
		const store = storeWith();
		mount(MEMBERS, store);
		await until(() => !!rowOf("Noor Haddad"), 10000);
		await until(
			() =>
				!!rowOf("Noor Haddad")?.querySelector(
					'[data-user-badge="play-store-tester"]',
				),
		);
		const noor = rowOf("Noor Haddad") as HTMLElement;
		expect(noor.querySelector("[data-badge-info]")).toBeNull();
		const activity = noor.querySelector<HTMLElement>("[data-member-activity]");
		expect(activity?.textContent).toBe("DUSQK");
		expect(
			activity?.querySelector('[data-activity-icon="listening"]'),
		).not.toBeNull();
		const name = noor.querySelector<HTMLElement>("[data-member-name]");
		const badge = noor.querySelector<HTMLElement>("[data-user-badge]");
		const nameBox = name?.getBoundingClientRect();
		const badgeBox = badge?.getBoundingClientRect();
		expect(badgeBox && nameBox && badgeBox.left >= nameBox.right).toBe(true);
		expect(
			badgeBox && noor.getBoundingClientRect().right >= badgeBox.right,
		).toBe(true);

		await until(
			() =>
				rowOf("Lena Fischer")?.querySelector("[data-member-activity]")
					?.textContent === "Celeste · Chapter 7",
		);
		expect(
			rowOf("Lena Fischer")?.querySelector('[data-user-badge="supporter-ten"]'),
		).not.toBeNull();
	});
});

describe("own profile activity prompt", () => {
	const promptCard = () =>
		document.querySelector<HTMLElement>('[data-activity-prompt="teal.fm"]');

	it("offers sharing when a listening service is found and hides on request", async () => {
		const store = storeWith(async () => "teal.fm");
		mount("/app/profile", store);
		await until(() => !!promptCard());
		expect(promptCard()?.textContent).toContain(
			"Let others see what you're listening to on teal.fm.",
		);
		const hide = Array.from(
			promptCard()?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent === "Hide");
		hide?.click();
		await until(() => !promptCard());
		expect(
			document.querySelector('[data-activity-prompt="dismissed"]'),
		).not.toBeNull();
		expect(localStorage.getItem(activityPromptKey(store.viewer.did))).toBe("1");
		expect(store.preferences.shareActivity()).toBe(false);
	});

	it("turns on sharing through the synced preferences", async () => {
		const store = storeWith(async () => "teal.fm");
		mount("/app/profile", store);
		await until(() => !!promptCard());
		const enable = Array.from(
			promptCard()?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent === "Turn on");
		enable?.click();
		await until(() => store.preferences.shareActivity());
		await until(() => !promptCard());
		expect(
			document.querySelector('[data-activity-prompt="dismissed"]'),
		).toBeNull();
	});

	it("stays away when nothing is detected", async () => {
		const store = storeWith(async () => null);
		mount("/app/profile", store);
		await until(() => !!document.querySelector("[data-profile-name]"));
		await wait(200);
		expect(document.querySelector("[data-activity-prompt]")).toBeNull();
	});
});

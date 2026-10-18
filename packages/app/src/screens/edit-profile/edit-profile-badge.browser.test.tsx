import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import "../../app.css";
import { badgeStoreFor } from "../../data/badges";
import { createMockSource, setLatency } from "../../data/mock/source";
import type { DataSource } from "../../data/source";
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

afterEach(async () => {
	stop?.();
	stop = undefined;
	document.body.innerHTML = "";
	await wait(50);
});

const withBadges = (source: DataSource, values: string[]): DataSource => ({
	...source,
	labeler: {
		queryLabels: async (dids) => ({
			labels: dids.flatMap((did) =>
				did === source.viewer().did
					? values.map((val) => ({
							uri: did,
							val,
							cts: new Date().toISOString(),
						}))
					: [],
			),
			truncated: false,
		}),
		definitions: async () => [],
	},
});

const mount = (badges: string[]) => {
	setLatency(0);
	window.history.replaceState(null, "", "/app/profile/edit");
	const source = withBadges(createMockSource({ live: false }), badges);
	const store = createDataStore(source);
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
	return { host, store, source };
};

const radio = (host: HTMLElement, value: string) =>
	host.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);

const saveButton = () =>
	Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
		(button) => button.textContent?.trim() === "Save",
	);

describe("edit profile badge choice", () => {
	it("saves the chosen badge and shows it first", async () => {
		const { host, store, source } = mount(["team", "supporter-ten"]);
		await until(() => !!radio(host, "supporter-ten"));
		expect(radio(host, "")?.checked).toBe(true);
		radio(host, "supporter-ten")?.click();
		await until(() => !!saveButton());
		saveButton()?.click();
		await until(() => store.viewer.preferredBadge === "supporter-ten");
		expect(badgeStoreFor(source).primary(store.viewer)?.identifier).toBe(
			"supporter-ten",
		);
	});

	it("hides the choice when there is only one badge", async () => {
		const { host } = mount(["team"]);
		await until(() => !!host.querySelector("[data-profile-edit-images]"));
		await wait(200);
		expect(radio(host, "team")).toBeNull();
	});
});

import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layoutIssues } from "../../../../../ui/src/foundations/layout-test";
import {
	createMockSource,
	type MockSource,
	setLatency,
} from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { TEXT_CHANNEL } from "../../../data/types";
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

const mount = async (
	path: string | ((source: MockSource) => Promise<string>),
) => {
	setLatency(0);
	const source = createMockSource({ live: false });
	history.replaceState(
		null,
		"",
		typeof path === "string" ? path : await path(source),
	);
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

const accessibleName = (element: HTMLElement) =>
	(element.getAttribute("aria-labelledby") ?? "")
		.split(" ")
		.map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
		.join(" ");

const selectNamed = (scope: ParentNode, name: RegExp) =>
	Array.from(
		scope.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'),
	).find((element) => name.test(accessibleName(element)));

const pick = async (scope: ParentNode, name: RegExp, value: string) => {
	const trigger = selectNamed(scope, name);
	if (!trigger) throw new Error(`No select named ${name}`);
	trigger.click();
	const option = () =>
		Array.from(
			document.querySelectorAll<HTMLInputElement>(
				'[role="dialog"] input[type="radio"]',
			),
		).find((input) => input.value === value);
	await until(() => !!option());
	await wait(300);
	option()?.click();
	await until(() => !document.querySelector('[role="dialog"]'));
};

const AWAITING = "Waiting for the bridge to report its channels";

const seededBridge = async (source: MockSource) => {
	const list = await source.listBridges(HQ);
	const found = list.find((entry) => entry.remoteSpaceName === "Libera Chat");
	if (!found) throw new Error("No seeded bridge");
	return found;
};

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
		buttonNamed(featured, "Connect Discord")?.click();
		await until(() => !!page(root, "bridge-connect"));
		const connect = page(root, "bridge-connect") as HTMLElement;
		expect(connect.textContent).toContain("Add the Colibri bot");
		expect(connect.querySelectorAll("ol > li")).toHaveLength(3);
		const submit = buttonNamed(connect, "Connect") as HTMLButtonElement;
		const submitDisabled = () =>
			submit.getAttribute("aria-disabled") === "true";
		expect(submitDisabled()).toBe(true);
		const field = connect.querySelector<HTMLInputElement>(
			'input[aria-label="Pairing code"]',
		) as HTMLInputElement;
		typeInto(field, "nope");
		await until(() => !submitDisabled());
		submit.click();
		await until(() => (connect.textContent ?? "").includes("didn't work"));
		typeInto(field, "DSCD2345");
		await until(() => !submitDisabled());
		submit.click();
		await until(() => !!dialogNamed(/^Connect /));
		const confirm = dialogNamed(/^Connect /) as HTMLElement;
		buttonNamed(confirm, "Connect")?.click();
		await until(() => !!page(root, "bridge-link"), 6000);
		await until(() => /\/manage\/bridge-link\/[^/]+$/.test(location.pathname));
		const bridges = store.directory.bridges(HQ);
		expect(bridges.registrations()?.length).toBe(before + 1);
		const step = page(root, "bridge-link") as HTMLElement;
		await until(() => (step.textContent ?? "").includes(AWAITING));
		await until(() => !(step.textContent ?? "").includes(AWAITING), 6000);
		const save = buttonNamed(step, "Save") as HTMLButtonElement;
		expect(save.getAttribute("aria-disabled") ?? String(save.disabled)).toBe(
			"true",
		);
		await pick(step, /^#/, "1189432076187713601");
		await pick(step, /^Import earlier messages into /, "week");
		expect(step.textContent).not.toContain("A new import starts");
		buttonNamed(step, "Save")?.click();
		await until(() => !!page(root, "bridge"), 6000);
		await until(() => /\/manage\/bridge\/[^/]+$/.test(location.pathname));
		const id = location.pathname.split("/").at(-1);
		const link = bridges.find(id as string)?.links[0];
		expect(link?.remoteRoom).toBe("1189432076187713601");
		const since = Date.parse(link?.backfill?.since ?? "");
		const requested = Date.parse(link?.backfill?.requestedAt ?? "");
		expect(Math.round((requested - since) / 86_400_000)).toBe(7);
		await wait(300);
		buttonNamed(
			page(root, "bridge") as HTMLElement,
			"Back to Bridges",
		)?.click();
		await until(() => location.pathname === `/app/c/${HQ}/manage/bridges`);
	});

	it("connects with a code from the Add manually page", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/bridge-new`);
		await until(() => !!page(root, "bridge-new"));
		buttonNamed(
			page(root, "bridge-new") as HTMLElement,
			"Add manually",
		)?.click();
		await until(() => !!page(root, "bridge-code"));
		const view = page(root, "bridge-code") as HTMLElement;
		const connect = buttonNamed(view, "Connect") as HTMLButtonElement;
		expect(connect.disabled).toBe(true);
		typeInto(fieldLabelled(view, "Code or Address"), "TELE2345");
		await until(() => !connect.disabled);
		connect.click();
		await until(() => !!dialogNamed(/^Connect /));
		buttonNamed(dialogNamed(/^Connect /) as HTMLElement, "Connect")?.click();
		await until(() => !!page(root, "bridge-link"), 6000);
	});

	it("asks before dropping a typed pairing code", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/bridge-new`);
		await until(() => !!page(root, "bridge-new"));
		buttonNamed(
			page(root, "bridge-new") as HTMLElement,
			"Add manually",
		)?.click();
		await until(() => !!page(root, "bridge-code"));
		const view = page(root, "bridge-code") as HTMLElement;
		typeInto(fieldLabelled(view, "Code or Address"), "TELE2345");
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

	it("adds a bridge by its address and opens a channel for it", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/bridge-code`);
		await until(() => !!page(root, "bridge-code"));
		const view = page(root, "bridge-code") as HTMLElement;
		const connect = buttonNamed(view, "Connect") as HTMLButtonElement;
		typeInto(fieldLabelled(view, "Code or Address"), "bad_name.example");
		await until(() => !connect.disabled);
		connect.click();
		await until(() => !!dialogNamed("Connect bad_name.example?"));
		buttonNamed(
			dialogNamed("Connect bad_name.example?") as HTMLElement,
			"Connect",
		)?.click();
		await until(() =>
			(view.textContent ?? "").includes("couldn't find a bridge"),
		);
		typeInto(fieldLabelled(view, "Code or Address"), "bolt.example.com");
		await until(() => !connect.disabled);
		connect.click();
		await until(() => !!dialogNamed("Connect bolt.example.com?"));
		const confirm = dialogNamed("Connect bolt.example.com?") as HTMLElement;
		expect(confirm.textContent).toContain(
			"can read and post only in the channels you pick next",
		);
		buttonNamed(confirm, "Connect")?.click();
		await until(() => !!page(root, "bridge-link"), 6000);
		const step = page(root, "bridge-link") as HTMLElement;
		await until(() => !!selectNamed(step, /^#/));
		expect(step.textContent).not.toContain(AWAITING);
		await pick(step, /^#/, "open");
		buttonNamed(step, "Skip")?.click();
		await until(() => !!page(root, "bridge"), 6000);
		expect(dialogNamed("Discard changes?")).toBeUndefined();
		const bridgePage = page(root, "bridge") as HTMLElement;
		await until(() =>
			(bridgePage.textContent ?? "").includes(
				"Pick the channels bolt.example.com can read and post in.",
			),
		);
		expect(bridgePage.textContent).toContain("Connected by address");
		expect(bridgePage.textContent).not.toContain(AWAITING);
		const triggers = () =>
			Array.from(
				bridgePage.querySelectorAll<HTMLElement>("[data-bridge-link]"),
			).map((row) => row.querySelector<HTMLElement>("button"));
		await until(() => triggers().length > 0);
		expect(triggers()[0]?.textContent).toContain("Not linked");
		const bridges = store.directory.bridges(HQ);
		const registration = bridges
			.registrations()
			?.find((entry) => entry.remoteSpaceName === "bolt.example.com");
		const community = store.communities
			.value()
			?.find((entry) => entry.did === HQ);
		const channel = community
			? store
					.space(community)
					.channels.value()
					?.find((entry) => entry.type === TEXT_CHANNEL)
			: undefined;
		expect(registration).toBeDefined();
		expect(registration?.channels).toEqual([]);
		expect(channel).toBeDefined();
		await bridges.update(registration?.id as string, {
			channels: [channel?.space as never],
		});
		await until(() =>
			triggers().some((trigger) =>
				(trigger?.textContent ?? "").includes("Let the bridge read and reply"),
			),
		);
		expect(
			bridgePage.querySelector('button[aria-label^="Import earlier messages"]'),
		).toBeNull();
	});

	it("refetches rooms and the registration on live bridge reports", async () => {
		let roomCalls = 0;
		let listCalls = 0;
		let registration = "";
		const { root, source } = await mount(async (mock) => {
			const listRooms = mock.listBridgeRooms;
			const listBridges = mock.listBridges;
			mock.listBridgeRooms = (input) => {
				roomCalls += 1;
				return listRooms(input);
			};
			mock.listBridges = (community) => {
				listCalls += 1;
				return listBridges(community);
			};
			registration = (await seededBridge(mock)).id;
			return `/app/c/${HQ}/manage/bridge/${registration}`;
		});
		await until(() => !!page(root, "bridge"));
		const view = page(root, "bridge") as HTMLElement;
		await until(() => !!selectNamed(view, /^#/));
		await until(() => roomCalls === 1);
		const lists = listCalls;
		source.emit({
			$type: "bridgeUpdateEvent",
			event: "backfill",
			community: HQ,
			registration,
		});
		await until(() => listCalls === lists + 1);
		expect(roomCalls).toBe(1);
		source.emit({
			$type: "bridgeUpdateEvent",
			event: "rooms",
			community: HQ,
			registration,
		});
		await until(() => roomCalls === 2);
		expect(view.querySelector('[aria-busy="true"]')).toBeNull();
	});

	it("shows the saved history import and starts a new one on reselect", async () => {
		let registration = "";
		const { root, store } = await mount(async (mock) => {
			registration = (await seededBridge(mock)).id;
			return `/app/c/${HQ}/manage/bridge/${registration}`;
		});
		await until(() => !!page(root, "bridge"));
		const view = page(root, "bridge") as HTMLElement;
		await until(() => !!selectNamed(view, /^Import earlier messages into /));
		const history = selectNamed(
			view,
			/^Import earlier messages into /,
		) as HTMLElement;
		expect(accessibleName(history)).toMatch(/All history$/);
		expect(view.textContent).toContain("312 messages.");
		const before = store.directory.bridges(HQ).find(registration)?.links[0]
			?.backfill?.requestedAt;
		await pick(view, /^Import earlier messages into /, "all");
		await until(() =>
			(view.textContent ?? "").includes("A new import starts when you save."),
		);
		await wait(300);
		buttonNamed(document.body, "Save")?.click();
		await until(
			() =>
				store.directory.bridges(HQ).find(registration)?.links[0]?.backfill
					?.requestedAt !== before,
		);
		const backfill = store.directory.bridges(HQ).find(registration)
			?.links[0]?.backfill;
		expect(backfill?.since).toBeUndefined();
	});

	it("keeps an existing import when the link's room stays the same", async () => {
		let registration = "";
		const { root, store } = await mount(async (mock) => {
			registration = (await seededBridge(mock)).id;
			return `/app/c/${HQ}/manage/bridge/${registration}`;
		});
		await until(() => !!page(root, "bridge"));
		const view = page(root, "bridge") as HTMLElement;
		await until(() => !!selectNamed(view, /^#/));
		const bridges = store.directory.bridges(HQ);
		const before = bridges.find(registration)?.links[0]?.backfill;
		const linked = Array.from(
			view.querySelectorAll<HTMLButtonElement>(
				'button[aria-haspopup="dialog"]',
			),
		).filter((element) => /^#\S+ #colibri-dev$/.test(accessibleName(element)));
		expect(linked).toHaveLength(1);
		const other = Array.from(
			view.querySelectorAll<HTMLButtonElement>(
				'button[aria-haspopup="dialog"]',
			),
		).find((element) => /^#\S+ Not linked$/.test(accessibleName(element)));
		const otherName = accessibleName(other as HTMLElement).split(" ")[0];
		await pick(view, new RegExp(`^${otherName} Not linked$`), "#colibri");
		await wait(300);
		buttonNamed(document.body, "Save")?.click();
		await until(() => (bridges.find(registration)?.links.length ?? 0) === 2);
		const kept = bridges
			.find(registration)
			?.links.find((link) => link.remoteRoom === "#colibri-dev");
		expect(kept?.backfill).toEqual(before);
	});
});

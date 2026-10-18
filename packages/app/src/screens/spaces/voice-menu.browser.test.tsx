import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { setVoiceSoundPlayer, voice } from "../../data/voice";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { closeVoicePrompt, voicePrompt } from "../voice/voice-prompt";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

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
let pointerSeed = 900;

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	voice.leave();
	closeVoicePrompt();
	stop?.();
	host?.remove();
	for (const dialog of document.body.querySelectorAll('[role="dialog"]')) {
		dialog.remove();
	}
	history.replaceState(null, "", originalPath);
});

const mount = async () => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	history.replaceState(null, "", `/app/c/${HQ}`);
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
	await until(() => !!loungeButton());
	return { root: host };
};

const textOf = (element: Element) =>
	element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";

const buttonNamed = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) => textOf(element) === name,
	);

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => element.getAttribute("aria-label") === name,
	);

const loungeRow = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			'[data-pane-index="0"] [data-voice-row]',
		),
	).find(
		(row) => row.querySelector("[data-channel-name]")?.textContent === "Lounge",
	);

const loungeButton = () =>
	loungeRow()?.querySelector<HTMLElement>(
		"button:not([data-voice-participant] button)",
	) ?? undefined;

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: ++pointerSeed,
		isPrimary: true,
		button: 0,
		clientX: box.left + Math.min(40, box.width / 2),
		clientY: box.top + box.height / 2,
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(500);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const openMenu = async () => {
	await hold(loungeButton() as HTMLElement);
	await until(() => !!dialogNamed("Lounge options"));
	await wait(400);
	return dialogNamed("Lounge options") as HTMLElement;
};

const sectionsOf = (dialog: HTMLElement) =>
	Array.from(dialog.querySelectorAll("section")).map((group) =>
		Array.from(group.querySelectorAll("button")).map((button) =>
			button.textContent?.trim(),
		),
	);

const topPane = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-pane-index]")).sort(
		(a, b) => Number(b.dataset.paneIndex) - Number(a.dataset.paneIndex),
	)[0] as HTMLElement;

describe("voice channel menu", () => {
	it("opens on hold with the voice entries and joins", async () => {
		await mount();
		const menu = await openMenu();
		expect(voicePrompt()).toBeUndefined();
		await expectNoLayoutIssues(menu);
		expect(sectionsOf(menu).slice(0, 3)).toEqual([
			["Join voice", "Open chat"],
			["Copy channel link"],
			["Duplicate", "Edit channel"],
		]);
		expect(buttonNamed(menu, "Mark as read")).toBeUndefined();
		buttonNamed(menu, "Join voice")?.click();
		await until(() => voice.current() !== undefined);
		voice.collapse();
		await until(() => !dialogNamed("Lounge options"));
		await wait(300);
		const reopened = await openMenu();
		expect(buttonNamed(reopened, "Open call")).toBeDefined();
		expect(buttonNamed(reopened, "Join voice")).toBeUndefined();
		buttonNamed(reopened, "Open call")?.click();
		await until(() => voice.expanded());
	});

	it("opens the voice chat as a page", async () => {
		const { root } = await mount();
		const menu = await openMenu();
		buttonNamed(menu, "Open chat")?.click();
		await until(() =>
			location.pathname.endsWith("/social.colibri.beta.channel.voice/lounge"),
		);
		await until(() => Number(topPane(root).dataset.paneIndex) === 1);
		expect(voice.current()).toBeUndefined();
	});

	it("opens channel settings from Edit channel", async () => {
		await mount();
		const menu = await openMenu();
		buttonNamed(menu, "Edit channel")?.click();
		await until(
			() => location.pathname === `/app/c/${HQ}/manage/channel/lounge`,
		);
	});

	it("does not start the menu from a participant row", async () => {
		await mount();
		await until(
			() =>
				(loungeRow()?.querySelectorAll("[data-voice-participant]").length ??
					0) > 0,
		);
		const person = loungeRow()?.querySelector<HTMLElement>(
			"[data-voice-participant] button, [data-voice-participant]",
		) as HTMLElement;
		const box = person.getBoundingClientRect();
		const init = {
			bubbles: true,
			pointerType: "touch",
			pointerId: ++pointerSeed,
			isPrimary: true,
			button: 0,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 2,
		};
		person.dispatchEvent(new PointerEvent("pointerdown", init));
		await wait(600);
		person.dispatchEvent(new PointerEvent("pointerup", init));
		expect(dialogNamed("Lounge options")).toBeUndefined();
	});
});

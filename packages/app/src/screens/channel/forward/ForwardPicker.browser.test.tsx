import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataContext, type DataStore } from "../../../data/store";
import type {
	ChannelView,
	CommunityView,
	MessageView,
	SpaceRef,
} from "../../../data/types";
import {
	createForwardPicker,
	type ForwardPickerOptions,
} from "./ForwardPicker";
import { type ForwardTarget, forwardChannelList } from "./forward-targets";

const TEXT = "social.colibri.beta.channel.text";
const VOICE = "social.colibri.beta.channel.voice";

const ref = (did: string, skey: string, type = TEXT) =>
	`at://${did}/space/${type}/${skey}` as SpaceRef;

const community = (did: string, name: string) =>
	({ did, name, handle: `${did.slice(8)}.test` }) as unknown as CommunityView;

const channel = (
	did: string,
	skey: string,
	name: string,
	extra: { type?: string; canPost?: boolean } = {},
) =>
	({
		space: ref(did, skey, extra.type ?? TEXT),
		type: extra.type ?? TEXT,
		name,
		viewer: { canRead: true, canPost: extra.canPost ?? true },
	}) as unknown as ChannelView;

const hq = community("did:plc:hq", "Colibri HQ");
const owls = community("did:plc:owls", "Night Owls Art Club");

const LONG_NAME =
	"a-channel-with-an-extremely-long-name-that-keeps-going-and-going-forever";

const channels: Record<string, ChannelView[]> = {
	"did:plc:hq": [
		channel("did:plc:hq", "general", "general"),
		channel("did:plc:hq", "design", "design"),
		channel("did:plc:hq", "lounge", "Lounge", { type: VOICE }),
		channel("did:plc:hq", "announcements", "announcements", {
			canPost: false,
		}),
		channel("did:plc:hq", "long", LONG_NAME),
	],
	"did:plc:owls": [channel("did:plc:owls", "showcase", "showcase")],
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	dispose?.();
	host?.remove();
	for (const node of document.querySelectorAll("[role=dialog]")) {
		node.closest("body > div")?.remove();
	}
});

const frames = (count = 3) =>
	new Promise<void>((resolve) => {
		const step = (left: number) =>
			left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
		step(count);
	});

const until = async (check: () => boolean, timeout = 3000) => {
	const start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("Timed out");
		await frames(1);
	}
};

const mount = (
	forwardMessage: (input: unknown) => Promise<MessageView>,
	options: ForwardPickerOptions = {},
) => {
	host = document.createElement("div");
	document.body.append(host);
	const store = {
		communities: { value: () => [hq, owls], loading: () => false },
		space: (space: CommunityView) => ({
			channels: { value: () => channels[space.did], loading: () => false },
			categories: { value: () => [], loading: () => false },
		}),
		forward: forwardMessage,
	} as unknown as DataStore;
	const picker = createForwardPicker(options);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<picker.Sheet />
			</DataContext.Provider>
		),
		host,
	);
	picker.open({
		channel: ref("did:plc:hq", "general"),
		rkey: "3abc",
		preview: "Heads up: the beta API moved",
	});
};

const dialog = () =>
	document.querySelector<HTMLElement>(
		'[role="dialog"][data-full-screen-sheet]',
	) as HTMLElement;

const rowFor = (name: string) =>
	[...dialog().querySelectorAll<HTMLElement>("[data-forward-channel]")]
		.find((element) => element.textContent === name)
		?.closest<HTMLElement>("div") ?? undefined;

const refFor = (name: string) =>
	Object.values(channels)
		.flat()
		.find((entry) => entry.name === name)?.space;

const checkboxFor = (name: string) =>
	dialog().querySelector<HTMLInputElement>(
		`input[type=checkbox][value="${refFor(name)}"]`,
	) ?? undefined;

const channelNames = () =>
	[...dialog().querySelectorAll("[data-forward-channel]")].map(
		(element) => element.textContent,
	);

const forwardButton = () =>
	dialog()
		.querySelector("[data-forward-submit]")
		?.closest("button") as HTMLButtonElement;

const type = (input: HTMLInputElement, value: string) => {
	input.value = value;
	input.dispatchEvent(new InputEvent("input", { bubbles: true }));
};

const select = async (name: string) => {
	const input = checkboxFor(name);
	if (!input) throw new Error(`No checkbox for ${name}`);
	input.click();
	await frames();
};

const insideBox = (inner: DOMRect, outer: DOMRect) =>
	inner.left >= outer.left - 0.5 &&
	inner.right <= outer.right + 0.5 &&
	inner.right <= document.documentElement.clientWidth + 0.5;

describe("forward picker", () => {
	it("lists only channels you can post in, grouped by Space", async () => {
		mount(vi.fn());
		await until(() => !!dialog());
		await frames(6);
		expect(channelNames()).toEqual([
			"general",
			"design",
			LONG_NAME,
			"showcase",
		]);
		expect(dialog().textContent).toContain("Current channel");
		expect(checkboxFor("general")?.disabled).toBe(true);
	});

	it("filters across Spaces", async () => {
		mount(vi.fn());
		await until(() => !!dialog());
		const search = dialog().querySelector<HTMLInputElement>(
			'input[aria-label="Search channels"], input[type=search]',
		) as HTMLInputElement;
		type(search, "show");
		await frames();
		expect(channelNames()).toEqual(["showcase"]);
		type(search, "#des");
		await frames();
		expect(channelNames()).toEqual(["design"]);
		type(search, "owls");
		await frames();
		expect(channelNames()).toEqual(["showcase"]);
	});

	it("forwards with the right refs and note", async () => {
		const forwardMessage = vi.fn(async () => ({}) as MessageView);
		const onOpenChannel = vi.fn();
		mount(forwardMessage, { onOpenChannel });
		await until(() => !!dialog());
		expect(forwardButton().disabled).toBe(true);
		await select("showcase");
		const note = [...dialog().querySelectorAll<HTMLInputElement>("input")].find(
			(input) => input.placeholder === "Optional",
		) as HTMLInputElement;
		type(note, "  look at this  ");
		await frames();
		forwardButton().click();
		await until(() => forwardMessage.mock.calls.length === 1);
		expect(forwardMessage).toHaveBeenCalledWith({
			from: ref("did:plc:hq", "general"),
			rkey: "3abc",
			to: ref("did:plc:owls", "showcase"),
			text: "look at this",
		});
	});

	it("keeps checked channels in place and counts them on the button", async () => {
		mount(vi.fn());
		await until(() => !!dialog());
		await frames(6);
		const before = channelNames();
		expect(forwardButton().textContent?.trim()).toBe("Forward");
		await select("showcase");
		expect(forwardButton().textContent?.trim()).toBe("Forward to 1 channel");
		await select("design");
		expect(channelNames()).toEqual(before);
		expect(forwardButton().textContent?.trim()).toBe("Forward to 2 channels");
		await select("showcase");
		expect(forwardButton().textContent?.trim()).toBe("Forward to 1 channel");
		expect(checkboxFor("design")?.checked).toBe(true);
		expect(checkboxFor("showcase")?.checked).toBe(false);
	});

	it("sends one forward per checked channel", async () => {
		const forwardMessage = vi.fn(
			async (_input: unknown) => ({}) as MessageView,
		);
		mount(forwardMessage);
		await until(() => !!dialog());
		await select("showcase");
		await select("design");
		forwardButton().click();
		await until(() => !dialog());
		expect(forwardMessage).toHaveBeenCalledTimes(2);
		expect(forwardMessage.mock.calls.map(([input]) => input)).toEqual([
			{
				from: ref("did:plc:hq", "general"),
				rkey: "3abc",
				to: ref("did:plc:hq", "design"),
			},
			{
				from: ref("did:plc:hq", "general"),
				rkey: "3abc",
				to: ref("did:plc:owls", "showcase"),
			},
		]);
	});

	it("keeps only the failed channels selected after a partial failure", async () => {
		const forwardMessage = vi.fn(async (input: unknown) => {
			if ((input as { to: string }).to === refFor("design")) {
				throw new Error("nope");
			}
			return {} as MessageView;
		});
		mount(forwardMessage);
		await until(() => !!dialog());
		await select("design");
		await select("showcase");
		await select(LONG_NAME);
		forwardButton().click();
		await until(() => forwardMessage.mock.calls.length === 3);
		await until(() => !forwardButton().disabled);
		expect(dialog()).not.toBeNull();
		expect(checkboxFor("design")?.checked).toBe(true);
		expect(checkboxFor("showcase")?.checked).toBe(false);
		expect(checkboxFor(LONG_NAME)?.checked).toBe(false);
		expect(forwardButton().textContent?.trim()).toBe("Forward to 1 channel");
		const failedRows = [
			...dialog().querySelectorAll<HTMLElement>("[data-forward-failed]"),
		];
		expect(failedRows).toHaveLength(1);
		expect(failedRows[0]?.textContent).toBe("Couldn't forward");
		forwardButton().click();
		await until(() => forwardMessage.mock.calls.length === 4);
		expect(forwardMessage.mock.calls[3]?.[0]).toMatchObject({
			to: refFor("design"),
		});
	});

	it("names forwarded channels and shortens long lists", () => {
		const targets = ["a", "b", "c", "d", "e"].map(
			(name) => ({ channel: { name } }) as unknown as ForwardTarget,
		);
		expect(forwardChannelList(targets.slice(0, 1))).toBe("#a");
		expect(forwardChannelList(targets.slice(0, 2))).toBe("#a and #b");
		expect(forwardChannelList(targets.slice(0, 3))).toBe("#a, #b, and #c");
		expect(forwardChannelList(targets)).toBe("#a, #b, and 3 more");
	});

	it("stays open when forwarding fails", async () => {
		const forwardMessage = vi.fn(async () => {
			throw new Error("nope");
		});
		mount(forwardMessage);
		await until(() => !!dialog());
		await select("design");
		forwardButton().click();
		await until(() => forwardMessage.mock.calls.length === 1);
		await frames(10);
		expect(dialog()).not.toBeNull();
		expect(forwardButton().disabled).toBe(false);
	});

	it("waits for a closing drawer before opening and then stays open", async () => {
		const blocker = document.createElement("div");
		blocker.setAttribute("role", "dialog");
		blocker.setAttribute("aria-label", "Message actions");
		document.body.append(blocker);
		mount(vi.fn());
		await frames(10);
		expect(
			document.querySelector('[role="dialog"][data-full-screen-sheet]'),
		).toBeNull();
		blocker.remove();
		await until(
			() => !!document.querySelector('[role="dialog"][data-full-screen-sheet]'),
		);
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(
			document.querySelector('[role="dialog"][data-full-screen-sheet]'),
		).not.toBeNull();
	});

	it("closes when swiped down from the header", async () => {
		mount(vi.fn());
		await until(() => !!dialog());
		await new Promise((resolve) => setTimeout(resolve, 500));
		const grab = dialog().querySelector(
			"[data-full-screen-sheet-grab]",
		) as HTMLElement;
		const box = grab.getBoundingClientRect();
		const send = (type: string, dy: number) =>
			grab.dispatchEvent(
				new PointerEvent(type, {
					pointerId: 5,
					pointerType: "touch",
					isPrimary: true,
					clientX: box.left + box.width / 2,
					clientY: box.bottom - 8 + dy,
					bubbles: true,
				}),
			);
		send("pointerdown", 0);
		for (const dy of [40, 90, 150]) {
			send("pointermove", dy);
			await new Promise((resolve) => setTimeout(resolve, 8));
		}
		send("pointerup", 150);
		await until(
			() => !document.querySelector('[role="dialog"][data-full-screen-sheet]'),
		);
	});

	it("keeps buttons and long names inside the drawer", async () => {
		mount(vi.fn());
		await until(() => !!dialog());
		await new Promise((resolve) => setTimeout(resolve, 500));
		const box = dialog().getBoundingClientRect();
		for (const button of dialog().querySelectorAll("button")) {
			const rect = button.getBoundingClientRect();
			if (rect.width === 0) continue;
			expect(insideBox(rect, box)).toBe(true);
		}
		const long = [
			...dialog().querySelectorAll<HTMLElement>("[data-forward-channel]"),
		].find((element) => element.textContent === LONG_NAME) as HTMLElement;
		expect(insideBox(long.getBoundingClientRect(), box)).toBe(true);
		const actions = dialog().querySelector(
			"[data-forward-actions]",
		) as HTMLElement;
		expect(actions.scrollWidth).toBeLessThanOrEqual(actions.clientWidth + 1);
		expect(rowFor("general")).toBeTruthy();
	});
});

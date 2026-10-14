import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { CUSTOM_EMOJI_FEATURE } from "../../../data/emoji";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import type { Did, Facet } from "../../../data/types";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;
const TEXT = "social.colibri.beta.channel.text";
const EMOJI = `/app/c/${HQ}/manage/emoji`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout)
			throw new Error(`Timed out: ${check.toString().slice(0, 120)}`);
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

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false });
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
	return { source, store, root: host };
};

const scrollToEnd = (root: HTMLElement) => {
	for (const element of activeScreen(root).querySelectorAll<HTMLElement>("*")) {
		if (
			/auto|scroll/.test(getComputedStyle(element).overflowY) &&
			element.scrollHeight > element.clientHeight
		) {
			element.scrollTop = element.scrollHeight;
		}
	}
};

const activeScreen = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-pane][data-pane-active]") ?? root;

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.includes(name),
	);

const type = (field: HTMLInputElement, value: string) => {
	field.focus();
	field.value = value;
	field.dispatchEvent(new InputEvent("input", { bubbles: true }));
};

const rowNames = (scope: ParentNode) =>
	Array.from(scope.querySelectorAll<HTMLElement>("[data-emoji-row]")).map(
		(row) => row.dataset.emojiRow,
	);

const groupNamed = (scope: ParentNode, label: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("section")).find(
		(section) => section.firstElementChild?.textContent?.trim() === label,
	);

const pressButton = async (scope: ParentNode, name: string | RegExp) => {
	let target: HTMLElement | undefined;
	await until(() => {
		target = buttonNamed(scope, name);
		return !!target && !(target as HTMLButtonElement).disabled;
	});
	target?.click();
};

describe("Space emoji", () => {
	it("lists packs, filters, and renames an emoji from its drawer", async () => {
		const { root } = await mount(EMOJI);
		await until(() => rowNames(activeScreen(root)).includes("coffee"));
		const screen = activeScreen(root);
		await expectNoLayoutIssues(
			screen.querySelector("[data-scroll-y]") as HTMLElement,
		);
		const ungrouped = groupNamed(screen, "Ungrouped");
		const release = groupNamed(screen, "Release day");
		expect(rowNames(ungrouped as HTMLElement)).toContain("colibri");
		expect(rowNames(release as HTMLElement)).toEqual([
			"shipit",
			"lgtm",
			"party_bird",
		]);

		const search = screen.querySelector<HTMLInputElement>(
			'input[type="search"]',
		) as HTMLInputElement;
		type(search, ":cof");
		await until(() => rowNames(activeScreen(root)).join() === "coffee");
		type(search, "");
		await until(() => rowNames(activeScreen(root)).length > 1);

		await pressButton(activeScreen(root), "More actions for :coffee:");
		await until(() => !!dialogNamed(":coffee: options"));
		const options = dialogNamed(":coffee: options") as HTMLElement;
		await wait(350);
		await expectNoLayoutIssues(options);
		await pressButton(options, "Rename emoji");
		let field: HTMLInputElement | null = null;
		await until(() => {
			field = options.querySelector<HTMLInputElement>("input");
			return !!field;
		});
		type(field as unknown as HTMLInputElement, "colibri");
		await until(() => options.textContent?.includes("already taken") ?? false);
		type(field as unknown as HTMLInputElement, "Iced Latte");
		await pressButton(options, "Save");
		await until(() => rowNames(activeScreen(root)).includes("iced_latte"));
		expect(rowNames(activeScreen(root))).not.toContain("coffee");
	});

	it("creates a pack from existing emoji, edits it and deletes it", async () => {
		const { root, store } = await mount(EMOJI);
		await until(() => rowNames(activeScreen(root)).includes("coffee"));
		await pressButton(activeScreen(root), "Create new Pack");
		await until(() => activeScreen(root).textContent?.includes("Pack Name"));
		const create = activeScreen(root);
		await until(
			() => create.querySelectorAll('input[type="checkbox"]').length > 0,
		);
		expect(buttonNamed(create, "Create")?.hasAttribute("disabled")).toBe(true);
		const nameField = create.querySelector<HTMLInputElement>(
			'input:not([type="search"])',
		) as HTMLInputElement;
		type(nameField, "Morning crew");
		for (const name of ["coffee", "bug"]) {
			(
				create.querySelector(
					`input[type="checkbox"][aria-label="Include :${name}:"]`,
				) as HTMLElement
			).click();
		}
		await wait(600);
		await expectNoLayoutIssues(
			create.querySelector("[data-scroll-y]") as HTMLElement,
		);
		await pressButton(create, "Create");
		await until(() => !!groupNamed(activeScreen(root), "Morning crew"), 6000);
		const list = activeScreen(root);
		expect(rowNames(groupNamed(list, "Morning crew") as HTMLElement)).toEqual([
			"coffee",
			"bug",
		]);
		expect(
			rowNames(groupNamed(list, "Ungrouped") as HTMLElement),
		).not.toContain("coffee");

		await pressButton(list, "Edit Morning crew");
		await until(() => activeScreen(root).textContent?.includes("Delete Pack"));
		const edit = activeScreen(root);
		await until(() => rowNames(edit).length === 2);
		await pressButton(edit, "More actions for :bug:");
		await until(() => !!dialogNamed(":bug: options"));
		await pressButton(
			dialogNamed(":bug: options") as HTMLElement,
			"Remove from pack",
		);
		await until(() => rowNames(activeScreen(root)).join() === "coffee");

		await pressButton(activeScreen(root), "Delete Pack");
		await until(() => !!dialogNamed("Delete Morning crew?"));
		await pressButton(
			dialogNamed("Delete Morning crew?") as HTMLElement,
			"Delete pack",
		);
		await until(
			() =>
				!groupNamed(activeScreen(root), "Morning crew") &&
				rowNames(activeScreen(root)).includes("coffee"),
			6000,
		);
		const catalog = store.emoji.catalog(HQ).value();
		expect(catalog?.packs.some((pack) => pack.name === "Morning crew")).toBe(
			false,
		);
	});

	it("uploads a GIF emoji after naming it", async () => {
		const { root } = await mount(EMOJI);
		await until(() => rowNames(activeScreen(root)).includes("coffee"));
		const input = activeScreen(root).querySelector<HTMLInputElement>(
			'input[type="file"]',
		) as HTMLInputElement;
		const gif = new File(
			[
				Uint8Array.from(
					atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="),
					(char) => char.charCodeAt(0),
				),
			],
			"Dancing Bird.gif",
			{ type: "image/gif" },
		);
		const transfer = new DataTransfer();
		transfer.items.add(gif);
		input.files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
		await until(() => !!dialogNamed("Name your emoji"));
		const naming = dialogNamed("Name your emoji") as HTMLElement;
		await until(
			() =>
				naming.querySelector<HTMLInputElement>("input")?.value ===
				"dancing_bird",
		);
		await wait(350);
		await expectNoLayoutIssues(naming);
		await pressButton(naming, "Upload emoji");
		await until(() => rowNames(activeScreen(root)).includes("dancing_bird"));
	});

	it("renders Space emoji in messages and offers them in the picker", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!store.emoji.catalog(HQ).value());
		await until(() => !!activeScreen(root).querySelector("[contenteditable]"));
		const general = (
			store
				.space(
					(store.communities.value() ?? []).find(
						(entry) => entry.did === HQ,
					) as never,
				)
				.channels.value() ?? []
		).find((entry) => entry.name === "general");
		if (!general) throw new Error("general missing");
		await store
			.channel(general.space)
			.send({ text: "ship it :shipit: :nope:" });
		await until(
			() =>
				!!activeScreen(root).querySelector('img[data-custom-emoji="shipit"]'),
		);
		expect(activeScreen(root).textContent).toContain(":nope:");

		await pressButton(activeScreen(root), /emoji/i);
		await until(() => !!document.querySelector('[role="dialog"]'));
		await until(() =>
			Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) =>
				dialog.textContent?.includes("Release day"),
			),
		);
	});

	it("renders emoji from another Space through its emoji facet", async () => {
		const owls = "did:plc:nightowlsartclub3e5f7g9h" as Did;
		const { root, store } = await mount(`/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!store.emoji.catalog(HQ).value());
		await until(() => !!store.emoji.catalog(owls).value());
		await until(() => !!activeScreen(root).querySelector("[contenteditable]"));
		const owl = store.emoji.find(owls, "owl");
		if (!owl) throw new Error("owl missing");
		expect(store.emoji.find(HQ, "owl")?.id).toBe(owl.id);
		const converted = store.emoji.withFacets(owls, "night :owl:", []);
		expect(converted.text).toBe("night 🦉");
		expect(converted.facets[0]?.features[0]).toEqual({
			$type: CUSTOM_EMOJI_FEATURE,
			uri: owl.id,
			cid: owl.ref.cid,
		});
		const general = (
			store
				.space(
					(store.communities.value() ?? []).find(
						(entry) => entry.did === HQ,
					) as never,
				)
				.channels.value() ?? []
		).find((entry) => entry.name === "general");
		if (!general) throw new Error("general missing");
		await store.channel(general.space).send(converted);
		await until(() => {
			scrollToEnd(root);
			return !!activeScreen(root).querySelector('img[data-custom-emoji="owl"]');
		});
		const image = activeScreen(root).querySelector<HTMLImageElement>(
			'img[data-custom-emoji="owl"]',
		);
		expect(image?.getAttribute("src")).toBe(owl.image);
	});

	it("follows an emoji and its pack from the message drawer", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!store.emoji.catalog(HQ).value());
		await until(() => !!activeScreen(root).querySelector("[contenteditable]"));
		const general = (
			store
				.space(
					(store.communities.value() ?? []).find(
						(entry) => entry.did === HQ,
					) as never,
				)
				.channels.value() ?? []
		).find((entry) => entry.name === "general");
		if (!general) throw new Error("general missing");
		await store
			.channel(general.space)
			.send(store.emoji.withFacets(HQ, "ship :shipit:", []));
		await until(() => {
			scrollToEnd(root);
			return !!activeScreen(root).querySelector(
				'[data-custom-emoji-button][data-custom-emoji-name="shipit"]',
			);
		});
		const button = activeScreen(root).querySelector<HTMLElement>(
			'[data-custom-emoji-button][data-custom-emoji-name="shipit"]',
		) as HTMLElement;
		button.click();
		await until(() => !!dialogNamed(":shipit:"));
		const drawer = dialogNamed(":shipit:") as HTMLElement;
		await until(() => !!drawer.textContent?.includes("Release day"));
		expect(drawer.textContent).toContain("Colibri HQ");
		await wait(350);
		await expectNoLayoutIssues(drawer);
		await pressButton(drawer, "Follow emoji");
		await until(() => drawer.textContent?.includes("Unfollow emoji") ?? false);
		await until(
			() =>
				store.emoji
					.followed()
					.value()
					?.emojis.some((emoji) => emoji.name === "shipit") ?? false,
		);
		await pressButton(drawer, "Follow pack");
		await until(() => drawer.textContent?.includes("Unfollow pack") ?? false);
		expect(
			store.emoji
				.followed()
				.value()
				?.emojis.map((emoji) => emoji.name)
				.sort(),
		).toEqual(["lgtm", "party_bird", "shipit"]);
	});

	const generalOf = (store: ReturnType<typeof createDataStore>) => {
		const general = (
			store
				.space(
					(store.communities.value() ?? []).find(
						(entry) => entry.did === HQ,
					) as never,
				)
				.channels.value() ?? []
		).find((entry) => entry.name === "general");
		if (!general) throw new Error("general missing");
		return general;
	};

	it("shows the text under an emoji facet it can't resolve", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!store.emoji.catalog(HQ).value());
		await until(() => !!activeScreen(root).querySelector("[contenteditable]"));
		const text = "lost 🦄 here";
		const start = new TextEncoder().encode("lost ").length;
		const facets = [
			{
				index: { byteStart: start, byteEnd: start + 4 },
				features: [
					{
						$type: CUSTOM_EMOJI_FEATURE,
						uri: `at://${HQ}/blue.moji.collection.item/unicorn`,
					},
				],
			},
		] as unknown as Facet[];
		await store.channel(generalOf(store).space).send({ text, facets });
		await until(() => {
			scrollToEnd(root);
			return !!activeScreen(root).textContent?.includes(text);
		});
		expect(
			activeScreen(root).querySelector('img[data-custom-emoji="unicorn"]'),
		).toBeNull();
	});

	it("turns a typed shortcode into an emoji in the composer and sends it as a facet", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!store.emoji.catalog(HQ).value());
		await until(() => !!activeScreen(root).querySelector("[contenteditable]"));
		const editor = activeScreen(root).querySelector<HTMLElement>(
			"[contenteditable]",
		) as HTMLElement;
		editor.focus();
		await userEvent.type(editor, "go :colibri:");
		await until(
			() =>
				!!editor.querySelector(
					'[data-mention-type="customEmoji"][data-custom-emoji="colibri"] img',
				),
		);
		await userEvent.keyboard("{Backspace}");
		await until(
			() => !editor.querySelector('[data-mention-type="customEmoji"]'),
		);
		await userEvent.type(editor, ":shipit:");
		await until(
			() =>
				!!editor.querySelector(
					'[data-mention-type="customEmoji"][data-custom-emoji="shipit"]',
				),
		);
		const shipit = store.emoji.find(HQ, "shipit");
		if (!shipit) throw new Error("shipit missing");
		const before = store.channel(generalOf(store).space).messages().length;
		const send = buttonNamed(activeScreen(root), /^send/i) as HTMLElement;
		send.click();
		await until(
			() => store.channel(generalOf(store).space).messages().length > before,
		);
		const sent = store.channel(generalOf(store).space).messages().at(-1);
		expect(sent?.text).toBe("go 🚀");
		const facet = sent?.facets?.find(
			(entry) => entry.features[0]?.$type === CUSTOM_EMOJI_FEATURE,
		);
		expect(facet?.features[0]).toMatchObject({ uri: shipit.id });
		const bytes = new TextEncoder().encode(sent?.text ?? "");
		expect(
			new TextDecoder().decode(
				bytes.subarray(facet?.index.byteStart, facet?.index.byteEnd),
			),
		).toBe("🚀");
	});

	describe("custom emoji policy", () => {
		const OWLS = "did:plc:nightowlsartclub3e5f7g9h" as Did;

		const ready = async () => {
			const mounted = await mount(`/app/c/${HQ}/${TEXT}/general`);
			const { store, root } = mounted;
			await until(() => !!store.emoji.catalog(HQ).value());
			await until(() => !!store.emoji.catalog(OWLS).value());
			await until(
				() => !!activeScreen(root).querySelector("[contenteditable]"),
			);
			return mounted;
		};

		const setPolicy = async (
			store: Awaited<ReturnType<typeof mount>>["store"],
			policy: "all" | "local" | "none",
		) => {
			await store.community.update({ community: HQ, customEmoji: policy });
			await until(() => store.emoji.policy(HQ) === policy);
		};

		const owlFacetMessage = (owlId: string) => {
			const text = "night 🦉";
			const start = new TextEncoder().encode("night ").length;
			return {
				text,
				facets: [
					{
						index: { byteStart: start, byteEnd: start + 4 },
						features: [{ $type: CUSTOM_EMOJI_FEATURE, uri: owlId }],
					},
				] as unknown as Facet[],
			};
		};

		it("offers another Space's emoji in the composer and sends its facet", async () => {
			const { root, store } = await ready();
			const owl = store.emoji.find(OWLS, "owl");
			if (!owl) throw new Error("owl missing");
			expect(
				store.emoji.search(HQ, "ow", 10).find((row) => row.name === "owl")
					?.source,
			).toBe("Night Owls Art Club");
			expect(
				store.emoji
					.packs(HQ)
					.some((pack) => pack.emojis.some((emoji) => emoji.id === owl.id)),
			).toBe(true);
			const editor = activeScreen(root).querySelector<HTMLElement>(
				"[contenteditable]",
			) as HTMLElement;
			editor.focus();
			await userEvent.type(editor, "hoot :owl:");
			await until(
				() =>
					!!editor.querySelector(
						'[data-mention-type="customEmoji"][data-custom-emoji="owl"]',
					),
			);
			const feed = store.channel(generalOf(store).space);
			const before = feed.messages().length;
			(buttonNamed(activeScreen(root), /^send/i) as HTMLElement).click();
			await until(() => feed.messages().length > before);
			const sent = feed.messages().at(-1);
			expect(sent?.text).toBe("hoot 🦉");
			expect(
				sent?.facets?.find(
					(entry) => entry.features[0]?.$type === CUSTOM_EMOJI_FEATURE,
				)?.features[0],
			).toMatchObject({ uri: owl.id });
			await until(() => {
				scrollToEnd(root);
				return !!activeScreen(root).querySelector(
					'img[data-custom-emoji="owl"]',
				);
			});
		});

		it("keeps only the Space's own emoji when limited to local emoji", async () => {
			const { root, store } = await ready();
			const owl = store.emoji.find(OWLS, "owl");
			const shipit = store.emoji.find(HQ, "shipit");
			if (!owl || !shipit) throw new Error("emoji missing");
			await setPolicy(store, "local");
			expect(store.emoji.find(HQ, "owl")).toBeUndefined();
			expect(store.emoji.find(HQ, "shipit")?.id).toBe(shipit.id);
			expect(
				store.emoji.search(HQ, "ow", 10).some((row) => row.name === "owl"),
			).toBe(false);
			expect(
				store.emoji
					.packs(HQ)
					.flatMap((pack) => pack.emojis)
					.some((emoji) => emoji.id === owl.id),
			).toBe(false);
			const converted = store.emoji.withFacets(
				HQ,
				"night :owl: :shipit:",
				owlFacetMessage(owl.id).facets,
			);
			expect(converted.text).toBe("night :owl: 🚀");
			expect(
				converted.facets.map(
					(facet) => (facet.features[0] as { uri?: string }).uri,
				),
			).toEqual([shipit.id]);
			const feed = store.channel(generalOf(store).space);
			await feed.send(owlFacetMessage(owl.id));
			await until(() => {
				scrollToEnd(root);
				return !!activeScreen(root).textContent?.includes("night 🦉");
			});
			expect(
				activeScreen(root).querySelector('img[data-custom-emoji="owl"]'),
			).toBeNull();
			expect(store.emoji.find(OWLS, "owl")?.id).toBe(owl.id);
		});

		it("shows every custom emoji as text when custom emoji are off", async () => {
			const { root, store } = await ready();
			const shipit = store.emoji.find(HQ, "shipit");
			if (!shipit) throw new Error("shipit missing");
			await setPolicy(store, "none");
			expect(store.emoji.search(HQ, "", 10)).toEqual([]);
			expect(store.emoji.packs(HQ)).toEqual([]);
			const editor = activeScreen(root).querySelector<HTMLElement>(
				"[contenteditable]",
			) as HTMLElement;
			editor.focus();
			await userEvent.type(editor, "go :shipit:");
			await wait(200);
			expect(
				editor.querySelector('[data-mention-type="customEmoji"]'),
			).toBeNull();
			const feed = store.channel(generalOf(store).space);
			const before = feed.messages().length;
			(buttonNamed(activeScreen(root), /^send/i) as HTMLElement).click();
			await until(() => feed.messages().length > before);
			const sent = feed.messages().at(-1);
			expect(sent?.text).toBe("go :shipit:");
			expect(
				(sent?.facets ?? []).some(
					(entry) => entry.features[0]?.$type === CUSTOM_EMOJI_FEATURE,
				),
			).toBe(false);
			const start = new TextEncoder().encode("raw ").length;
			await feed.send({
				text: "raw 🚀",
				facets: [
					{
						index: { byteStart: start, byteEnd: start + 4 },
						features: [{ $type: CUSTOM_EMOJI_FEATURE, uri: shipit.id }],
					},
				] as unknown as Facet[],
			});
			await until(() => {
				scrollToEnd(root);
				return !!activeScreen(root).textContent?.includes("raw 🚀");
			});
			expect(
				activeScreen(root).querySelector('img[data-custom-emoji="shipit"]'),
			).toBeNull();
		});

		it("saves the setting from the Messages page", async () => {
			const { root, store } = await mount(`/app/c/${HQ}/manage/messages`);
			await until(() =>
				(activeScreen(root).textContent ?? "").includes("Custom emoji"),
			);
			const option = Array.from(
				activeScreen(root).querySelectorAll<HTMLInputElement>(
					'input[type="radio"]',
				),
			).find((input) => input.value === "local");
			expect(option).toBeTruthy();
			option?.click();
			await until(() => store.emoji.policy(HQ) === "local");
			await until(() => activeScreen(root).style.transform === "");
			await wait(100);
			await expectNoLayoutIssues(
				activeScreen(root).querySelector("[data-scroll-y]") as HTMLElement,
			);
		});
	});
});

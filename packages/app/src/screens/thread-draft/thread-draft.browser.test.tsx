import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../../data/store";
import type { MessageView } from "../../data/types";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { suggestThreadName } from "./thread-name";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const GENERAL = `/app/c/${HQ}/${TEXT}/general`;

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

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
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
	return { store, root: host };
};

const pane = (root: HTMLElement, index: number) =>
	root.querySelector<HTMLElement>(`[data-pane-index="${index}"]`);

const generalRef = (store: DataStore) => {
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	return hq ? store.space(hq).channelBySlug("general")?.space : undefined;
};

const settled = (root: HTMLElement, depth: number) => {
	const above = pane(root, depth + 1);
	return (
		pane(root, depth)?.style.transform === "" && above?.style.transform !== ""
	);
};

const press = async (target: HTMLElement) => {
	const box = target.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 41,
		isPrimary: true,
		clientX: box.left + 40,
		clientY: box.top + box.height / 2,
	};
	target.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(650);
	target.dispatchEvent(new PointerEvent("pointerup", init));
};

const button = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.trim() === name,
	);

const typeAndSend = async (scope: HTMLElement, text: string) => {
	const editor = scope.querySelector<HTMLElement>('[role="textbox"]');
	if (!editor) throw new Error("no composer");
	editor.focus();
	await userEvent.keyboard(text);
	const send = button(scope, "Send message");
	if (!send) throw new Error("no send button");
	send.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	send.click();
};

const threadOf = (store: DataStore, anchor: MessageView) => {
	const ref = generalRef(store);
	return ref
		? store
				.channel(ref)
				.threads.value()
				?.find(
					(thread) =>
						(thread.anchor as { rkey?: string } | undefined)?.rkey ===
						anchor.rkey,
				)
		: undefined;
};

describe("thread draft", () => {
	it("starts a thread from a message and lands in it", async () => {
		const { store, root } = await mount(GENERAL);
		await until(() => !!generalRef(store));
		const ref = generalRef(store);
		if (!ref) throw new Error("no general");
		const feed = store.channel(ref);
		await until(() => feed.ready());
		await until(() => !!feed.threads.value());
		await until(() => !!pane(root, 1)?.querySelector("[data-message-key]"));
		const taken = new Set(
			(feed.threads.value() ?? []).map(
				(thread) => (thread.anchor as { rkey?: string } | undefined)?.rkey,
			),
		);
		const rows = Array.from(
			pane(root, 1)?.querySelectorAll<HTMLElement>("[data-message-key]") ?? [],
		);
		const row = rows.reverse().find((element) => {
			const key = element.dataset.messageKey ?? "";
			const message = feed.messages().find((entry) => entry.rkey === key);
			return !!message?.text && !taken.has(key);
		});
		if (!row) throw new Error("no message without a thread");
		const anchor = feed
			.messages()
			.find((entry) => entry.rkey === row.dataset.messageKey) as MessageView;

		await press(row);
		await until(() => !!button(document, "Open thread"));
		await userEvent.click(button(document, "Open thread") as HTMLElement);
		await until(() => settled(root, 2));
		const draft = pane(root, 2) as HTMLElement;
		expect(location.pathname).toBe(`${GENERAL}/t/new/${anchor.rkey}`);
		const input = draft.querySelector<HTMLInputElement>("input");
		expect(input?.placeholder).toBe(suggestThreadName(anchor.text));
		expect(draft.querySelector("[data-thread-anchor]")?.textContent).toContain(
			anchor.text.slice(0, 20),
		);
		await expectNoLayoutIssues(draft);

		await typeAndSend(draft, "Kicking this off");
		await until(() => !!threadOf(store, anchor));
		const thread = threadOf(store, anchor);
		const skey = thread?.space.split("/").at(-1) ?? "";
		await until(() => location.pathname === `${GENERAL}/t/${skey}`);
		await until(() => settled(root, 2));
		await until(
			() =>
				!!pane(root, 2)?.textContent?.includes("Kicking this off") &&
				store
					.channel(thread?.space as NonNullable<typeof thread>["space"])
					.messages()
					.some((message) => message.text === "Kicking this off"),
		);
		expect(thread?.name).toBe(suggestThreadName(anchor.text));
		await until(
			() =>
				pane(root, 1)
					?.querySelector(
						`[data-message-key="${CSS.escape(anchor.rkey)}"] [data-thread-name]`,
					)
					?.textContent?.trim() === thread?.name,
		);

		history.back();
		await until(() => location.pathname === GENERAL);
		await until(() => settled(root, 1));
	});

	it("starts a named thread from the channel drawer", async () => {
		const { store, root } = await mount(`/app/c/${HQ}`);
		await until(() => !!generalRef(store));
		const findRow = () =>
			Array.from(root.querySelectorAll<HTMLElement>("[data-channel-row]")).find(
				(element) =>
					element.querySelector("[data-channel-name]")?.textContent?.trim() ===
					"general",
			);
		await until(() => !!findRow());
		const row = findRow() as HTMLElement;
		await press(row);
		await until(() => !!button(document, "Start a thread"));
		await userEvent.click(button(document, "Start a thread") as HTMLElement);
		await until(() => settled(root, 2));
		expect(location.pathname).toBe(`${GENERAL}/t/new`);
		await until(() => !!pane(root, 2)?.querySelector("input"));
		const draft = pane(root, 2) as HTMLElement;
		expect(draft.querySelector("[data-thread-anchor]")).toBeNull();
		const name =
			"A very long thread name about the release plan and everything around it";
		await userEvent.type(
			draft.querySelector("input") as HTMLInputElement,
			name,
		);
		await expectNoLayoutIssues(draft);
		await typeAndSend(draft, "Notes go here");
		const ref = generalRef(store);
		await until(
			() =>
				!!ref &&
				!!store
					.channel(ref)
					.threads.value()
					?.some((thread) => thread.name === name),
		);
		await until(() => /\/t\/[^/]+$/.test(location.pathname));
		expect(location.pathname.endsWith("/t/new")).toBe(false);
		history.back();
		await until(() => location.pathname === GENERAL);
	});

	it("sends custom emoji in the first message as emoji facets", async () => {
		const { store, root } = await mount(`${GENERAL}/t/new`);
		await until(() => !!pane(root, 2)?.querySelector('[role="textbox"]'));
		await until(() => settled(root, 2));
		const draft = pane(root, 2) as HTMLElement;
		await typeAndSend(draft, "go :shipit:");
		await until(() => /\/t\/[^/]+$/.test(location.pathname));
		const ref = generalRef(store);
		await until(() => {
			const created = ref
				? store
						.channel(ref)
						.threads.value()
						?.find((entry) =>
							location.pathname.endsWith(entry.space.split("/").at(-1) ?? ""),
						)
				: undefined;
			const first = created
				? store.channel(created.space).messages()[0]
				: undefined;
			return (
				first?.facets?.some((facet) =>
					facet.features.some((feature) =>
						String(feature.$type).endsWith("#customEmoji"),
					),
				) === true
			);
		});
	});

	it("keeps the draft when creating the thread fails", async () => {
		const { store, root } = await mount(`${GENERAL}/t/new`);
		await until(() => settled(root, 2));
		await until(() => !!pane(root, 2)?.querySelector("input"));
		const draft = pane(root, 2) as HTMLElement;
		await userEvent.type(
			draft.querySelector("input") as HTMLInputElement,
			"this will fail",
		);
		const before = (() => {
			const ref = generalRef(store);
			return ref ? (store.channel(ref).threads.value() ?? []).length : 0;
		})();
		await typeAndSend(draft, "first words");
		await until(() =>
			Array.from(document.querySelectorAll("[data-toast]")).some((toast) =>
				toast.textContent?.includes("Couldn't create the thread"),
			),
		);
		expect(location.pathname).toBe(`${GENERAL}/t/new`);
		expect(draft.querySelector("input")?.value).toBe("this will fail");
		expect(draft.textContent).toContain("first words");
		const ref = generalRef(store);
		expect(ref ? (store.channel(ref).threads.value() ?? []).length : 0).toBe(
			before,
		);
	});
});

import "../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../data/store";
import { Providers } from "../providers";
import { usePlatform } from "../screen/platform";
import { DesktopShell } from "./desktop/DesktopShell";
import { THREAD_WIDTH_KEY } from "./desktop/sidebar-width";
import { MobileShell } from "./MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const STORAGE_KEYS = [
	"colibri:last-space",
	`colibri:last-channel:${HQ}`,
	THREAD_WIDTH_KEY,
];

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let dispose: (() => void) | undefined;
let draftKeys: string[] = [];

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	for (const key of [...STORAGE_KEYS, ...draftKeys]) {
		localStorage.removeItem(key);
	}
	draftKeys = [];
	history.replaceState(null, "", "/");
});

type Source = ReturnType<typeof createMockSource>;

const mount = async (
	path: string,
	options: {
		desktop?: boolean;
		prepare?: (source: Source) => void;
	} = {},
) => {
	setLatency(0);
	await page.viewport(
		options.desktop ? 1440 : 402,
		options.desktop ? 900 : 874,
	);
	const platform = usePlatform();
	await until(() => (platform() === "desktop") === !!options.desktop);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false });
	options.prepare?.(source);
	const store = createDataStore(source);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	const Shell = options.desktop ? DesktopShell : MobileShell;
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<Shell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { store, host };
};

const failCommunitiesOnce = (source: Source) => {
	const original = source.listCommunities;
	let failures = 1;
	source.listCommunities = () => {
		if (failures > 0) {
			failures -= 1;
			return Promise.reject(new TypeError("Failed to fetch"));
		}
		return original();
	};
};

const generalRef = async () => {
	setLatency(0);
	const store = createDataStore(createMockSource({ live: false }));
	await until(() => !!store.communities.value());
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("HQ missing");
	const space = store.space(hq);
	await until(() => !!space.channels.value());
	const ref = space.channelBySlug("general")?.space;
	if (!ref) throw new Error("general missing");
	return ref;
};

const composerText = (host: HTMLElement) =>
	host.querySelector<HTMLElement>("[data-composer] [contenteditable]")
		?.textContent ?? "";

describe("load errors", () => {
	it("shows an error state on mobile when Spaces fail and recovers on retry", async () => {
		const { store } = await mount(`/app/c/${HQ}`, {
			prepare: failCommunitiesOnce,
		});
		await expect
			.element(page.getByRole("heading", { name: "Your Spaces didn't load" }))
			.toBeVisible();
		expect(store.communities.error()?.code).toBe("NetworkFailed");
		await expect
			.element(page.getByText("Error code: NetworkFailed"))
			.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "Try again" }));
		await until(() => !!store.communities.value());
		expect(store.communities.error()).toBeUndefined();
		await expect
			.poll(
				() => document.querySelector("[data-status-screen]")?.textContent ?? "",
			)
			.not.toContain("didn't load");
	});

	it("shows the error in the desktop main area and opens a channel after retry", async () => {
		await mount(`/app/c/${HQ}`, {
			desktop: true,
			prepare: failCommunitiesOnce,
		});
		await expect
			.element(page.getByRole("heading", { name: "Your Spaces didn't load" }))
			.toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "Try again" }));
		await expect.poll(() => location.pathname).toContain(TEXT);
	});

	it("exposes a feed load error with a reload", async () => {
		setLatency(0);
		const source = createMockSource({ live: false });
		const original = source.listMessages;
		let failures = 1;
		source.listMessages = (params) => {
			if (failures > 0) {
				failures -= 1;
				return Promise.reject(new TypeError("Failed to fetch"));
			}
			return original(params);
		};
		const store: DataStore = createDataStore(source);
		await until(() => !!store.communities.value());
		const hq = store.communities.value()?.find((entry) => entry.did === HQ);
		if (!hq) throw new Error("HQ missing");
		const space = store.space(hq);
		await until(() => !!space.channels.value());
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		const feed = store.channel(general.space);
		await until(() => !!feed.loadError());
		expect(feed.ready()).toBe(false);
		const retried = feed.reload();
		expect(feed.loadError()?.code).toBe("NetworkFailed");
		await retried;
		expect(feed.loadError()).toBeUndefined();
		expect(feed.ready()).toBe(true);
		expect(feed.messages().length).toBeGreaterThan(0);
	});
});

describe("thread load errors", () => {
	it("shows a retryable error when the thread list fails", async () => {
		setLatency(0);
		const probe = createDataStore(createMockSource({ live: false }));
		await until(() => !!probe.communities.value());
		const hq = probe.communities.value()?.find((entry) => entry.did === HQ);
		if (!hq) throw new Error("HQ missing");
		const channels = probe.space(hq).channels;
		await until(() => !!channels.value());
		let target: { channel: string; thread: string } | undefined;
		for (const channel of channels.value() ?? []) {
			if (channel.type !== TEXT) continue;
			const threads = probe.channel(channel.space).threads;
			await until(() => !!threads.value());
			const thread = threads.value()?.[0];
			if (!thread) continue;
			const slug = (ref: string) => ref.slice(ref.lastIndexOf("/") + 1);
			target = { channel: slug(channel.space), thread: slug(thread.space) };
			break;
		}
		if (!target) throw new Error("no thread in the mock data");
		const failing = target;
		let threadsDown = true;
		await mount(`/app/c/${HQ}/${TEXT}/${failing.channel}/t/${failing.thread}`, {
			prepare: (source) => {
				const original = source.listThreads;
				source.listThreads = (channel) =>
					threadsDown && channel.endsWith(`/${failing.channel}`)
						? Promise.reject(new TypeError("Failed to fetch"))
						: original(channel);
			},
		});
		await expect
			.element(page.getByRole("heading", { name: "This thread didn't load" }))
			.toBeVisible();
		threadsDown = false;
		await userEvent.click(page.getByRole("button", { name: "Try again" }));
		await expect
			.poll(() => document.body.textContent ?? "")
			.not.toContain("This thread didn't load");
		expect(document.body.textContent).not.toContain(
			"This thread doesn't exist anymore",
		);
	});
});

describe("unknown paths", () => {
	it("shows a 404 layer on mobile with a way back to Spaces", async () => {
		await mount("/app/somewhere/else");
		await expect
			.element(page.getByRole("heading", { name: "Page not found" }))
			.toBeVisible();
		expect(location.pathname).toBe("/app/somewhere/else");
		await userEvent.click(page.getByRole("button", { name: "Go to Spaces" }));
		await expect.poll(() => location.pathname).not.toBe("/app/somewhere/else");
		expect(location.pathname.startsWith("/app")).toBe(true);
	});

	it("shows the 404 screen in the desktop main area", async () => {
		await mount(`/app/c/${HQ}/manage/nope`, { desktop: true });
		await expect
			.element(page.getByRole("heading", { name: "Page not found" }))
			.toBeVisible();
		expect(location.pathname).toBe(`/app/c/${HQ}/manage/nope`);
		await userEvent.click(page.getByRole("button", { name: "Go to Spaces" }));
		await expect.poll(() => location.pathname).toContain(TEXT);
	});
});

describe("device-local restore", () => {
	it("reopens the last viewed Space and channel on a mobile cold start", async () => {
		localStorage.setItem("colibri:last-space", HQ);
		localStorage.setItem(`colibri:last-channel:${HQ}`, "general");
		await mount("/app");
		await expect
			.poll(() => location.pathname)
			.toBe(`/app/c/${HQ}/${TEXT}/general`);
	});

	it("reopens the last viewed channel on a desktop cold start", async () => {
		localStorage.setItem("colibri:last-space", HQ);
		localStorage.setItem(`colibri:last-channel:${HQ}`, "general");
		await mount("/app", { desktop: true });
		await expect
			.poll(() => location.pathname)
			.toBe(`/app/c/${HQ}/${TEXT}/general`);
	});

	it("restores and saves the channel composer draft", async () => {
		const ref = await generalRef();
		const key = `colibri:draft:${ref}`;
		draftKeys.push(key);
		localStorage.setItem(
			key,
			JSON.stringify({
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "half-written reply" }],
					},
				],
			}),
		);
		const { host } = await mount(`/app/c/${HQ}/${TEXT}/general`);
		await expect
			.poll(() => composerText(host), { timeout: 8000 })
			.toBe("half-written reply");
		const editor = host.querySelector<HTMLElement>(
			"[data-composer] [contenteditable]",
		);
		if (!editor) throw new Error("composer missing");
		await userEvent.click(editor);
		await userEvent.keyboard(" and more");
		await expect
			.poll(() => localStorage.getItem(key) ?? "")
			.toContain("half-written reply and more");
	});

	it("persists the desktop thread pane width", async () => {
		setLatency(0);
		const probe = createDataStore(createMockSource({ live: false }));
		await until(() => !!probe.communities.value());
		const hq = probe.communities.value()?.find((entry) => entry.did === HQ);
		if (!hq) throw new Error("HQ missing");
		const channels = probe.space(hq).channels;
		await until(() => !!channels.value());
		let target: { channel: string; thread: string } | undefined;
		for (const channel of channels.value() ?? []) {
			if (channel.type !== TEXT) continue;
			const threads = probe.channel(channel.space).threads;
			await until(() => !!threads.value());
			const thread = threads.value()?.[0];
			if (!thread) continue;
			const slug = (ref: string) => ref.slice(ref.lastIndexOf("/") + 1);
			target = { channel: slug(channel.space), thread: slug(thread.space) };
			break;
		}
		if (!target) throw new Error("no thread in the mock data");
		localStorage.setItem(THREAD_WIDTH_KEY, "520");
		await mount(`/app/c/${HQ}/${TEXT}/${target.channel}/t/${target.thread}`, {
			desktop: true,
		});
		const pane = () =>
			document.querySelector<HTMLElement>("[data-shell-thread]");
		await expect.poll(() => pane()?.style.width).toBe("520px");
		const handle = pane()?.querySelector<HTMLElement>("[data-pane-resizer]");
		if (!handle) throw new Error("resizer missing");
		await expect
			.poll(() => document.querySelector("[data-boot-content][inert]"))
			.toBeNull();
		handle.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => pane()?.style.width).not.toBe("520px");
		const resized = pane()?.style.width;
		await expect
			.poll(() => `${localStorage.getItem(THREAD_WIDTH_KEY)}px`)
			.toBe(resized);
	});
});

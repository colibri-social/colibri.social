import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { skeyOf } from "../../data/ids";
import { fx, mark, rich } from "../../data/mock/rich";
import {
	createMockSource,
	pendingLatency,
	setLatency,
} from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { Did } from "../../data/types";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const frame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const settle = async () => {
	let quiet = 0;
	while (quiet < 3) {
		await frame();
		quiet = pendingLatency() === 0 ? quiet + 1 : 0;
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	setLatency(0);
	history.replaceState(null, "", originalPath);
});

const buttonStarting = (root: HTMLElement, name: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("button")).find((element) =>
		(element.getAttribute("aria-label") ?? element.textContent ?? "")
			.trim()
			.startsWith(name),
	);

const openHqGeneral = async () => {
	setLatency(80, 260);
	history.replaceState(null, "", "/");
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const root = host;
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
	const hq = source.world.spaces.find((entry) => entry.seed.key === "hq");
	const general = hq?.channels.find(
		(entry) => skeyOf(entry.view.space) === "general",
	);
	const authors = (hq?.members ?? [])
		.map((member) => member.actor.did as Did)
		.filter((did) => did !== source.world.viewerDid)
		.slice(0, 4);
	if (!hq || !general || authors.length < 2) {
		throw new Error("fixtures missing");
	}
	await until(() => store.notifications.status() === "ready");
	await until(() => !!buttonStarting(root, "Colibri HQ"));
	buttonStarting(root, "Colibri HQ")?.click();
	await until(() => !!buttonStarting(root, "general"));

	const scroller = () =>
		root.querySelector<HTMLElement>(
			'[data-pane-index="1"] [data-message-list-scroller]',
		);
	const atRest = async () => {
		let still = 0;
		while (still < 3) {
			await frame();
			const pane = root.querySelector<HTMLElement>('[data-pane-index="1"]');
			still = pane && pane.getBoundingClientRect().left === 0 ? still + 1 : 0;
		}
		await settle();
	};
	const latest = () => source.world.messagesOf(general).at(-1)?.rkey;
	const readThrough = async () => {
		buttonStarting(root, "general")?.click();
		await until(() => location.pathname.endsWith("/general"));
		await until(() => !!scroller()?.querySelector("article[data-message-key]"));
		await atRest();
		await until(() => {
			const element = scroller();
			if (!element) return false;
			const bottom =
				element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
			if (!bottom) element.scrollTop += 250;
			return bottom && general.readCursor === latest();
		});
		await settle();
	};
	const leave = async () => {
		history.back();
		await until(() => !location.pathname.endsWith("/general"));
		await until(() => store.viewing() === undefined);
		await settle();
	};
	const mention = (text: string) => {
		const body = rich(
			mark("@Louis", fx.mention(source.world.viewerDid)),
			` ${text}`,
		);
		return source.simulateMessage({
			author: authors[0] as Did,
			channel: general.view.space,
			text: body.text,
			facets: body.facets,
		});
	};
	const chatter = async (count: number) => {
		for (let index = 0; index < count; index++) {
			source.simulateMessage({
				author: authors[(index % (authors.length - 1)) + 1] as Did,
				channel: general.view.space,
				text: `filler line ${index} that keeps the conversation going`,
			});
			await frame();
		}
	};
	const mentions = () => {
		const view = store.communities
			.value()
			?.find((entry) => entry.did === hq.did);
		return view ? store.space(view).unread("general").mentions : -1;
	};
	return { general, latest, readThrough, leave, mention, chatter, mentions };
};

describe("mention badges", () => {
	it("clears seeded mentions after reading the channel", async () => {
		const chat = await openHqGeneral();
		await until(() => chat.mentions() > 0);
		await chat.readThrough();
		expect(chat.mentions()).toBe(0);
	});

	it("clears mentions that arrive while the channel is open", async () => {
		const chat = await openHqGeneral();
		await chat.readThrough();
		expect(chat.mentions()).toBe(0);
		const one = chat.mention("ping one");
		await until(() => chat.general.readCursor === one.rkey);
		await settle();
		const two = chat.mention("ping two");
		await until(() => chat.general.readCursor === two.rkey);
		await settle();
		expect(chat.mentions()).toBe(0);
	});

	it("keeps the unread marker for a mention that arrives after leaving", async () => {
		const chat = await openHqGeneral();
		await chat.readThrough();
		await chat.leave();
		const cursor = chat.general.readCursor;
		chat.mention("are you around?");
		await chat.chatter(18);
		await settle();
		expect(chat.general.readCursor).toBe(cursor);
		expect(chat.mentions()).toBe(1);
		await chat.readThrough();
		expect(chat.mentions()).toBe(0);
	});
});

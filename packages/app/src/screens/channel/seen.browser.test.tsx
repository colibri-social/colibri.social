import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { SpaceRef } from "../../data/types";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const GENERAL = `at://${HQ}/space/${TEXT}/general` as SpaceRef;

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

const mount = (path: string) => {
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

const onScreen = (root: HTMLElement, rkey: string) => {
	const element = root.querySelector<HTMLElement>(
		`article[data-message-key="${rkey}"]`,
	);
	if (!element) return false;
	const box = element.getBoundingClientRect();
	return box.bottom > 0 && box.top < window.innerHeight && box.height > 0;
};

describe("seen messages", () => {
	it("clears Inbox entries only for messages that scroll into view", async () => {
		const { store } = mount(`/app/c/${HQ}/${TEXT}/off-topic`);
		const unseenIn = (ref: SpaceRef) =>
			store.notifications
				.items()
				.filter(
					(entry) =>
						!entry.seenAt &&
						!entry.thread &&
						entry.channel === ref &&
						!!entry.message,
				);
		await until(() => store.notifications.status() === "ready");
		const hq = () =>
			store.communities.value()?.find((entry) => entry.did === HQ);
		await until(() => !!hq());
		const before = unseenIn(GENERAL);
		expect(before.length).toBeGreaterThan(0);
		await wait(800);
		expect(unseenIn(GENERAL)).toHaveLength(before.length);

		history.replaceState(null, "", "/");
		stop?.();
		host?.remove();
		const second = mount(`/app/c/${HQ}/${TEXT}/general`);
		await until(() => second.store.notifications.status() === "ready");
		await until(() => !!second.root.querySelector("article[data-message-key]"));
		await wait(1200);
		const unseen = () =>
			second.store.notifications
				.items()
				.filter(
					(entry) =>
						!entry.seenAt &&
						!entry.thread &&
						entry.channel === GENERAL &&
						!!entry.message,
				);
		const all = second.store.notifications
			.items()
			.filter((entry) => !entry.thread && entry.channel === GENERAL);
		const originallyUnseen = all.filter((entry) =>
			before.some((previous) => previous.id === entry.id),
		);
		for (const entry of originallyUnseen) {
			const rkey = entry.message?.rkey ?? "";
			if (onScreen(second.root, rkey)) expect(entry.seenAt).toBeTruthy();
			else expect(entry.seenAt).toBeFalsy();
		}
		const afterOpen = unseen().length;
		const community = second.store.communities
			.value()
			?.find((entry) => entry.did === HQ);
		if (!community) throw new Error("community missing");
		await until(
			() =>
				second.store.space(community).unread("general").mentions ===
				unseen().length,
		);

		const scroller = Array.from(
			second.root.querySelectorAll<HTMLElement>("*"),
		).find(
			(element) =>
				/auto|scroll/.test(getComputedStyle(element).overflowY) &&
				element.scrollHeight > element.clientHeight + 10 &&
				!!element.querySelector("article[data-message-key]"),
		);
		if (!scroller) throw new Error("scroller missing");
		for (let step = 0; step < 40; step++) {
			scroller.scrollTop += 300;
			await wait(40);
		}
		await wait(800);
		const remaining = unseen();
		if (afterOpen > 0) expect(remaining.length).toBeLessThan(afterOpen);
		for (const entry of remaining) {
			expect(onScreen(second.root, entry.message?.rkey ?? "")).toBe(false);
		}
		await until(
			() =>
				second.store.space(community).unread("general").mentions ===
				unseen().length,
		);
	});
});

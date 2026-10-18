import "../../app.css";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { skeyOf } from "../../data/ids";
import { createMessageCache } from "../../data/message-cache";
import { createMockSource, setLatency } from "../../data/mock/source";
import type { DataSource } from "../../data/source";
import { createDataStore, DataContext } from "../../data/store";
import type { SpaceRef } from "../../data/types";
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

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
const originalPath = location.pathname + location.search;

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

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const mount = async (options: { live?: boolean } = {}) => {
	setLatency(120, 200);
	history.replaceState(null, "", "/");
	const base = createMockSource({ live: false });
	const requested: string[] = [];
	const refreshed: string[] = [];
	const source: DataSource = {
		...base,
		listMessages: (params) => {
			requested.push(params.channel);
			if (!params.cursor) refreshed.push(params.channel);
			return base.listMessages(params);
		},
	};
	const general = base.world.spaces
		.find((entry) => entry.did === HQ)
		?.channels.find((entry) => skeyOf(entry.view.space) === "general")?.view
		.space as SpaceRef | undefined;
	if (!general) throw new Error("Seed changed");
	if (options.live) await base.markRead(general);
	const [epoch] = createSignal<number | undefined>(1);
	const store = createDataStore(source, {
		cache: createMessageCache({ namespace: "slide", kv: null }),
		...(options.live ? { live: { epoch } } : {}),
	});
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
	await until(() => !!buttonStarting(root, "Colibri HQ"));
	buttonStarting(root, "Colibri HQ")?.click();
	await until(() => !!buttonStarting(root, "general"));
	const pane = () => root.querySelector<HTMLElement>('[data-pane-index="1"]');
	const sliding = () => {
		const left = pane()?.getBoundingClientRect().left ?? 0;
		return left > 1;
	};
	const settled = async () => {
		let still = 0;
		while (still < 3) {
			await frame();
			still = pane()?.getBoundingClientRect().left === 0 ? still + 1 : 0;
		}
	};
	const openChannel = async (name: string) => {
		buttonStarting(root, name)?.click();
		await until(() => !!pane());
	};
	const leave = async () => {
		const back = pane()?.querySelector<HTMLElement>(
			'button[aria-label="Back to channels"]',
		);
		if (!back) throw new Error("back button missing");
		back.click();
		await until(() => store.viewing() === undefined);
		await until(() => !pane() || !sliding());
		await new Promise((resolve) => setTimeout(resolve, 400));
	};
	const rows = () =>
		pane()?.querySelectorAll("article[data-message-key]").length ?? 0;
	const skeletons = () =>
		pane()?.querySelectorAll("[data-message-skeleton]").length ?? 0;
	const visibleSkeletons = () => {
		const current = pane();
		if (!current) return 0;
		const bounds = current.getBoundingClientRect();
		return Array.from(
			current.querySelectorAll<HTMLElement>("[data-message-skeleton]"),
		).filter((element) => {
			const rect = element.getBoundingClientRect();
			return rect.bottom > bounds.top && rect.top < bounds.bottom;
		}).length;
	};
	return {
		base,
		store,
		general,
		requested,
		refreshed,
		root,
		pane,
		sliding,
		settled,
		openChannel,
		leave,
		rows,
		skeletons,
		visibleSkeletons,
	};
};

it("renders a cached channel during the slide and keeps the layout intact", async () => {
	const app = await mount();
	await app.openChannel("general");
	await app.settled();
	await until(() => app.rows() > 0);
	await app.leave();

	await app.openChannel("general");
	let slideFrames = 0;
	while (slideFrames === 0 || app.sliding()) {
		if (app.sliding()) {
			slideFrames += 1;
			expect(app.rows()).toBeGreaterThan(0);
			expect(app.visibleSkeletons()).toBe(0);
		}
		await frame();
	}
	expect(slideFrames).toBeGreaterThan(3);
	const pane = app.pane();
	if (!pane) throw new Error("pane missing");
	await app.settled();
	const list = pane.querySelector<HTMLElement>("[data-message-list-content]");
	if (!list) throw new Error("message list missing");
	await expectNoLayoutIssues(list);
	expect(app.visibleSkeletons()).toBe(0);
});

it("still shows the skeleton for a channel with nothing cached", async () => {
	const app = await mount();
	await app.openChannel("general");
	await until(() => app.sliding() && app.visibleSkeletons() > 0);
	expect(app.rows()).toBe(0);
	await app.settled();
	await until(() => app.rows() > 0);
});

it("paints a channel fed by the live tail before any request", async () => {
	const app = await mount({ live: true });
	await until(() => !!app.store.lastMessage(app.general));
	await new Promise((resolve) => setTimeout(resolve, 600));
	const author = app.base.world.spaces
		.find((entry) => entry.did === HQ)
		?.members.find((member) => member.actor.did !== app.base.world.viewerDid)
		?.actor.did;
	if (!author) throw new Error("Seed changed");
	const arrived = app.base.simulateMessage({
		author,
		channel: app.general,
		text: "Hot off the socket",
	});
	await app.openChannel("general");
	await until(() => app.rows() > 0);
	expect(app.requested.filter((ref) => ref === app.general)).toEqual([]);
	await app.settled();
	const shown = Array.from(
		app.pane()?.querySelectorAll<HTMLElement>("article[data-message-key]") ??
			[],
	).map((row) => row.dataset.messageKey);
	expect(shown).toContain(arrived.rkey);
	await new Promise((resolve) => setTimeout(resolve, 400));
	expect(app.refreshed.filter((ref) => ref === app.general)).toEqual([]);
});

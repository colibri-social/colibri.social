import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { systemWindowControls } from "../../data/system-window-controls";
import { Providers } from "../../providers";
import { DesktopShell } from "./DesktopShell";
import {
	desktopRailPaddingTop,
	fixedFrame,
	markChromeMode,
	syncFixedFrame,
	windowBarHeight,
} from "./window-chrome";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0";
const MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";

type Internals = {
	invoke: ReturnType<typeof vi.fn>;
	transformCallback: (callback: (message: unknown) => void) => number;
	metadata?: unknown;
};

let dispose: (() => void) | undefined;

afterEach(() => {
	systemWindowControls()[1](false);
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	delete (window as unknown as { __TAURI_INTERNALS__?: Internals })
		.__TAURI_INTERNALS__;
	delete (window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown })
		.__TAURI_EVENT_PLUGIN_INTERNALS__;
	vi.restoreAllMocks();
});

const fakeShell = (
	agent: string | undefined,
	state: {
		maximized: boolean;
		layout?: unknown;
		nativeDecorations?: boolean;
		fixedFrame?: boolean;
	} = { maximized: false },
) => {
	if (agent) {
		vi.spyOn(Navigator.prototype, "userAgent", "get").mockReturnValue(agent);
	}
	const callbacks = new Map<number, (message: unknown) => void>();
	const listeners = new Map<string, number[]>();
	const invoke = vi.fn(
		async (command: string, args?: Record<string, unknown>) => {
			if (command === "plugin:window|is_maximized") return state.maximized;
			if (command === "plugin:window|is_fullscreen") return false;
			if (command === "titlebar_init")
				return {
					state: {
						maximized: state.maximized,
						fullscreen: false,
						nativeDecorations: state.nativeDecorations ?? false,
					},
					buttonLayout: state.layout ?? null,
					fixedFrame: state.fixedFrame ?? false,
				};
			if (command === "plugin:event|listen") {
				const event = args?.event as string;
				listeners.set(event, [
					...(listeners.get(event) ?? []),
					args?.handler as number,
				]);
				return callbacks.size;
			}
			return null;
		},
	);
	(
		window as unknown as { __TAURI_INTERNALS__: Internals }
	).__TAURI_INTERNALS__ = {
		invoke,
		transformCallback: (callback) => {
			const id = callbacks.size + 1;
			callbacks.set(id, callback);
			return id;
		},
		metadata: {
			currentWindow: { label: "main" },
			currentWebview: { windowLabel: "main", label: "main" },
		},
	};
	(
		window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }
	).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
	const emit = (event: string, payload: unknown) => {
		for (const id of listeners.get(event) ?? []) {
			callbacks.get(id)?.({ event, id, payload });
		}
	};
	const listening = (event: string) => listeners.has(event);
	return Object.assign(invoke, { emit, listening });
};

const commands = (invoke: ReturnType<typeof vi.fn>) =>
	invoke.mock.calls.map(([command]) => command);

const mount = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await expect.poll(() => location.pathname).toContain("channel.text");
	return store;
};

const bar = () => document.querySelector<HTMLElement>("[data-window-bar]");

describe("desktop title bar", () => {
	it("stays hidden in the browser", async () => {
		await mount();
		expect(bar()).toBeNull();
		await expect.poll(() => document.title).toContain("·");
	});

	it("leaves room for the traffic lights on macOS and syncs the window title", async () => {
		const invoke = fakeShell(MAC);
		const store = await mount();
		await expect.poll(bar).not.toBeNull();
		const element = bar() as HTMLElement;
		expect(Math.round(element.getBoundingClientRect().height)).toBe(36);
		const inset = element.querySelector<HTMLElement>(
			"[data-traffic-light-inset]",
		);
		expect(inset?.getBoundingClientRect().width).toBe(72);
		const barBox = element.getBoundingClientRect();
		const barCenter = barBox.top + barBox.height / 2;
		for (const button of element.querySelectorAll<HTMLElement>(
			"[data-title-bar-nav] button",
		)) {
			const box = button.getBoundingClientRect();
			expect(box.top + box.height / 2).toBeCloseTo(barCenter, 0);
		}
		expect(element.querySelector("[data-window-controls]")).toBeNull();
		expect(element.getAttribute("data-tauri-drag-region")).toBe("deep");
		const space = store.spaceByKey(HQ);
		expect(element.textContent).toContain(space?.name);
		await expect
			.poll(() =>
				invoke.mock.calls.find(([command]) => command === "titlebar_set_title"),
			)
			.toBeTruthy();
		const call = invoke.mock.calls.find(
			([command]) => command === "titlebar_set_title",
		);
		expect(call?.[1]).toMatchObject({
			title: expect.stringContaining(` · ${space?.name}`),
		});
		expect(document.title).toBe(call?.[1]?.title);
		expect(
			invoke.mock.calls.some(
				([command]) => command === "plugin:window|set_title",
			),
		).toBe(false);
	});

	it("draws window controls on Windows and drives the window", async () => {
		const state = { maximized: false };
		const invoke = fakeShell(WINDOWS, state);
		await mount();
		await expect.poll(bar).not.toBeNull();
		const element = bar() as HTMLElement;
		expect(Math.round(element.getBoundingClientRect().height)).toBe(32);
		expect(element.querySelector("[data-traffic-light-inset]")).toBeNull();
		const controls = page.getByRole("button", { name: "Minimize" });
		await userEvent.click(controls);
		await expect
			.poll(() => invoke.mock.calls.map(([command]) => command))
			.toContain("plugin:window|minimize");
		state.maximized = true;
		await userEvent.click(page.getByRole("button", { name: "Maximize" }));
		await expect
			.poll(() => invoke.mock.calls.map(([command]) => command))
			.toContain("plugin:window|toggle_maximize");
		window.dispatchEvent(new Event("resize"));
		await expect
			.element(page.getByRole("button", { name: "Restore" }))
			.toBeVisible();
		const trailing = element.querySelector("[data-window-bar-trailing]");
		expect(trailing?.querySelector("[data-window-controls]")).not.toBeNull();
		expect(
			element
				.querySelector("[data-title-bar-nav]")
				?.getAttribute("data-tauri-drag-region"),
		).toBe("false");
	});

	it("puts a feedback button at the right end on macOS that opens the feedback form", async () => {
		const invoke = fakeShell(MAC);
		await mount();
		await expect.poll(bar).not.toBeNull();
		const element = bar() as HTMLElement;
		const feedback = element.querySelector<HTMLElement>(
			"[data-window-bar-trailing] [data-title-bar-feedback] button",
		);
		expect(feedback?.getAttribute("aria-label")).toBe("Send feedback");
		const barBox = element.getBoundingClientRect();
		const box = feedback?.getBoundingClientRect();
		expect(barBox.right - (box?.right ?? 0)).toBeLessThanOrEqual(16);
		expect(box?.top ?? -1).toBeGreaterThanOrEqual(barBox.top);
		expect(box?.bottom ?? Infinity).toBeLessThanOrEqual(barBox.bottom);
		await userEvent.click(page.getByRole("button", { name: "Send feedback" }));
		await expect
			.poll(
				() =>
					invoke.mock.calls.find(
						([command]) => command === "open_external_url",
					)?.[1],
			)
			.toMatchObject({ url: expect.stringContaining("userinput.app") });
	});

	it("places the feedback button left of the Windows window controls", async () => {
		fakeShell(WINDOWS);
		await mount();
		await expect.poll(bar).not.toBeNull();
		const element = bar() as HTMLElement;
		const feedback = element.querySelector<HTMLElement>(
			"[data-title-bar-feedback]",
		);
		const controls = element.querySelector<HTMLElement>(
			"[data-window-controls]",
		);
		expect(feedback).not.toBeNull();
		expect(controls).not.toBeNull();
		expect(
			feedback?.getBoundingClientRect().right ?? Infinity,
		).toBeLessThanOrEqual(controls?.getBoundingClientRect().left ?? 0);
	});

	it("shows every window control when the Linux desktop lists only close", async () => {
		fakeShell(LINUX, {
			maximized: false,
			layout: { left: [], right: ["close"] },
		});
		await mount();
		await expect
			.poll(() =>
				Array.from(
					bar()?.querySelectorAll<HTMLElement>("[data-control]") ?? [],
				).map((button) => button.dataset.control),
			)
			.toEqual(["minimize", "maximize", "close"]);
	});

	it("puts the controls on the left when the Linux desktop does", async () => {
		fakeShell(LINUX, {
			maximized: false,
			layout: { left: ["close", "minimize", "maximize"], right: [] },
		});
		await mount();
		await expect
			.poll(() =>
				bar()?.querySelector(
					"[data-window-bar-leading] [data-window-controls]",
				),
			)
			.not.toBeNull();
		const order = Array.from(
			bar()?.querySelectorAll<HTMLElement>("[data-control]") ?? [],
		).map((button) => button.dataset.control);
		expect(order).toEqual(["close", "minimize", "maximize"]);
		expect(
			bar()?.querySelector(
				"[data-window-bar-trailing] [data-title-bar-feedback]",
			),
		).not.toBeNull();
	});

	it("resizes the frameless Linux window from its edges until it is maximized", async () => {
		const state = { maximized: false };
		const invoke = fakeShell(LINUX, state);
		await mount();
		await expect.poll(bar).not.toBeNull();
		const edges = () =>
			Array.from(
				document.querySelectorAll<HTMLElement>("[data-resize-edge]"),
			).map((edge) => edge.dataset.resizeEdge);
		await expect.poll(edges).toHaveLength(8);

		const corner = document.querySelector<HTMLElement>(
			'[data-resize-edge="SouthEast"]',
		) as HTMLElement;
		const box = corner.getBoundingClientRect();
		expect(box.right).toBe(window.innerWidth);
		expect(box.bottom).toBe(window.innerHeight);
		corner.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);
		await expect
			.poll(() =>
				invoke.mock.calls.find(
					([command]) => command === "plugin:window|start_resize_dragging",
				),
			)
			.toBeTruthy();
		expect(
			invoke.mock.calls.find(
				([command]) => command === "plugin:window|start_resize_dragging",
			)?.[1],
		).toMatchObject({ value: "SouthEast" });

		state.maximized = true;
		window.dispatchEvent(new Event("resize"));
		await expect.poll(edges).toHaveLength(0);
	});

	it("hides the bar when the Linux compositor draws a fixed frame", async () => {
		const state = { maximized: false, fixedFrame: true };
		fakeShell(LINUX, state);
		syncFixedFrame();
		await expect.poll(fixedFrame).toBe(true);
		await mount();
		await expect.poll(() => location.pathname).toContain("channel.text");
		expect(bar()).toBeNull();
		expect(document.querySelector("[data-resize-edges]")).toBeNull();
		expect(windowBarHeight()).toBe(0);
		markChromeMode();
		expect(document.documentElement.dataset.windowFrame).toBe("system");
		state.fixedFrame = false;
		syncFixedFrame();
		await expect.poll(fixedFrame).toBe(false);
		await expect.poll(bar).not.toBeNull();
		expect(document.documentElement.dataset.windowFrame).toBeUndefined();
	});

	it("leaves resizing to the system frame on Windows", async () => {
		fakeShell(WINDOWS);
		await mount();
		await expect.poll(bar).not.toBeNull();
		expect(document.querySelector("[data-resize-edges]")).toBeNull();
	});

	it("hands the maximize button to Windows snap layouts and opens the system menu", async () => {
		const invoke = fakeShell(WINDOWS);
		await mount();
		await expect.poll(bar).not.toBeNull();
		const element = bar() as HTMLElement;
		await expect
			.poll(() =>
				invoke.mock.calls.find(
					([command]) => command === "titlebar_set_snap_rect",
				),
			)
			.toBeTruthy();
		const maximize = element.querySelector<HTMLElement>(
			'[data-control="maximize"]',
		) as HTMLElement;
		const box = maximize.getBoundingClientRect();
		const dpr = window.devicePixelRatio;
		const sent = invoke.mock.calls.findLast(
			([command]) => command === "titlebar_set_snap_rect",
		)?.[1];
		expect(sent).toEqual({
			x: Math.floor(box.left * dpr),
			y: Math.floor(box.top * dpr),
			width: Math.ceil(box.right * dpr) - Math.floor(box.left * dpr),
			height: Math.ceil(box.bottom * dpr) - Math.floor(box.top * dpr),
		});

		await expect
			.poll(() => invoke.listening("colibri-titlebar-controls"))
			.toBe(true);
		invoke.emit("colibri-titlebar-controls", { button: "maximize" });
		await expect.poll(() => maximize.hasAttribute("data-hovered")).toBe(true);
		invoke.emit("colibri-titlebar-controls", { button: null });
		await expect.poll(() => maximize.hasAttribute("data-hovered")).toBe(false);

		element.dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
		);
		await expect
			.poll(() => commands(invoke))
			.toContain("titlebar_show_system_menu");

		dispose?.();
		dispose = undefined;
		await expect
			.poll(() => commands(invoke))
			.toContain("titlebar_clear_snap_rect");
	});

	it("hides the bar while the system draws the window frame", async () => {
		fakeShell(MAC);
		await mount();
		await expect.poll(bar).not.toBeNull();
		systemWindowControls()[1](true);
		await expect.poll(bar).toBeNull();
		expect(windowBarHeight()).toBe(0);
		expect(desktopRailPaddingTop()).toBe(8);
		systemWindowControls()[1](false);
		await expect.poll(bar).not.toBeNull();
		expect(windowBarHeight()).toBe(36);
	});

	it("skips snap layouts and the system menu under the system frame", async () => {
		const invoke = fakeShell(WINDOWS);
		systemWindowControls()[1](true);
		await mount();
		await expect.poll(() => commands(invoke)).toContain("titlebar_set_title");
		expect(bar()).toBeNull();
		expect(commands(invoke)).not.toContain("titlebar_set_snap_rect");
	});
});

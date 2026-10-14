import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { DesktopShell } from "./DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0";
const MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";

type Internals = {
	invoke: ReturnType<typeof vi.fn>;
	metadata?: unknown;
};

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	delete (window as unknown as { __TAURI_INTERNALS__?: Internals })
		.__TAURI_INTERNALS__;
	vi.restoreAllMocks();
});

const fakeShell = (
	agent: string | undefined,
	state: { maximized: boolean; layout?: unknown } = { maximized: false },
) => {
	if (agent) {
		vi.spyOn(Navigator.prototype, "userAgent", "get").mockReturnValue(agent);
	}
	const invoke = vi.fn(
		async (command: string, _args?: Record<string, unknown>) => {
			if (command === "plugin:window|is_maximized") return state.maximized;
			if (command === "plugin:window|is_fullscreen") return false;
			if (command === "titlebar_init")
				return { buttonLayout: state.layout ?? null };
			return null;
		},
	);
	(
		window as unknown as { __TAURI_INTERNALS__: Internals }
	).__TAURI_INTERNALS__ = {
		invoke,
		metadata: {
			currentWindow: { label: "main" },
			currentWebview: { windowLabel: "main", label: "main" },
		},
	};
	return invoke;
};

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
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	installExternalLinkInterceptor,
	isExternalHref,
	openExternalUrl,
} from "./open-external";

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

const anchor = (attrs: Record<string, string>) => {
	const element = document.createElement("a");
	for (const [key, value] of Object.entries(attrs))
		element.setAttribute(key, value);
	element.textContent = "link";
	document.body.append(element);
	return element;
};

const click = (element: Element, init: MouseEventInit = {}) => {
	const event = new MouseEvent("click", {
		bubbles: true,
		cancelable: true,
		button: 0,
		...init,
	});
	element.dispatchEvent(event);
	return event;
};

describe("open-external", () => {
	let uninstall: () => void;
	let invoke: ReturnType<typeof vi.fn>;
	let open: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		uninstall = installExternalLinkInterceptor();
		invoke = vi.fn(() => Promise.resolve());
		open = vi.spyOn(window, "open").mockImplementation(() => null);
	});

	afterEach(() => {
		uninstall();
		open.mockRestore();
		delete (window as TauriWindow).__TAURI_INTERNALS__;
		document.body.replaceChildren();
	});

	const enableTauri = () => {
		(window as TauriWindow).__TAURI_INTERNALS__ = {
			invoke,
			transformCallback: () => 0,
		};
	};

	it("treats only other origins as external", () => {
		expect(isExternalHref("https://example.com/a")).toBe(true);
		expect(isExternalHref(`${location.origin}/channel`)).toBe(false);
		expect(isExternalHref("/relative")).toBe(false);
		expect(isExternalHref("javascript:alert(1)")).toBe(false);
		expect(isExternalHref("mailto:hi@example.com")).toBe(false);
		enableTauri();
		expect(isExternalHref("mailto:hi@example.com")).toBe(true);
	});

	it("opens a new tab on the web", () => {
		openExternalUrl("https://example.com/");
		expect(open).toHaveBeenCalledWith(
			"https://example.com/",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("opens the system browser in the native app", async () => {
		enableTauri();
		openExternalUrl("https://example.com/");
		await vi.waitFor(() =>
			expect(invoke).toHaveBeenCalledWith(
				"plugin:opener|open_url",
				{ url: "https://example.com/" },
				undefined,
			),
		);
		expect(open).not.toHaveBeenCalled();
	});

	it("routes native anchor clicks through the opener", async () => {
		enableTauri();
		const link = anchor({ href: "https://example.com/x", target: "_blank" });
		const event = click(link);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
	});

	it("leaves links another handler already claimed", () => {
		enableTauri();
		const link = anchor({ href: "https://example.com/x" });
		link.addEventListener("click", (event) => event.preventDefault());
		click(link);
		expect(invoke).not.toHaveBeenCalled();
	});

	it("opens untargeted external links in a new tab on the web", () => {
		const link = anchor({ href: "https://example.com/y" });
		const event = click(link);
		expect(event.defaultPrevented).toBe(true);
		expect(open).toHaveBeenCalledWith(
			"https://example.com/y",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("lets the browser handle targeted, modified and internal clicks", () => {
		const claimed: boolean[] = [];
		const record = (event: Event) => {
			claimed.push(event.defaultPrevented);
			event.preventDefault();
		};
		window.addEventListener("click", record);
		click(anchor({ href: "https://example.com/", target: "_blank" }));
		click(anchor({ href: "/channel" }));
		click(anchor({ href: "https://example.com/" }), { metaKey: true });
		window.removeEventListener("click", record);
		expect(claimed).toEqual([false, false, false]);
		expect(open).not.toHaveBeenCalled();
	});
});

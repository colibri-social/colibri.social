import { afterEach, expect, it, vi } from "vitest";
import type { Route } from "../shell/layers";
import { listenForAppLinks } from "./deep-links";
import { installExternalLinkInterceptor } from "./open-external";

const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.restoreAllMocks();
});

const anchor = (href: string, attributes: Record<string, string> = {}) => {
	const element = document.createElement("a");
	element.href = href;
	element.textContent = "link";
	for (const [name, value] of Object.entries(attributes))
		element.setAttribute(name, value);
	document.body.append(element);
	cleanups.push(() => element.remove());
	return element;
};

const setup = () => {
	const routes: Route[] = [];
	cleanups.push(installExternalLinkInterceptor());
	cleanups.push(listenForAppLinks((route) => routes.push(route)));
	const open = vi.spyOn(window, "open").mockReturnValue(null);
	return { routes, open };
};

const click = (element: HTMLElement, init: MouseEventInit = {}) => {
	const event = new MouseEvent("click", {
		bubbles: true,
		cancelable: true,
		button: 0,
		...init,
	});
	element.dispatchEvent(event);
	return event;
};

it("opens invite and pack links in the app from any anchor", () => {
	const { routes, open } = setup();
	const invite = click(
		anchor("https://spaces.colibri.social/invite/flock", { target: "_blank" }),
	);
	const pack = click(
		anchor("https://colibri.social/emoji/did:plc:abc/3kowls", {
			target: "_blank",
		}),
	);
	expect(invite.defaultPrevented).toBe(true);
	expect(pack.defaultPrevented).toBe(true);
	expect(routes.map((route) => route.layers[0]?.kind)).toEqual([
		"join",
		"pack",
	]);
	expect(open).not.toHaveBeenCalled();
});

it("leaves modified clicks and other sites to the browser", () => {
	const { routes } = setup();
	const modified = click(
		anchor("https://spaces.colibri.social/invite/flock", { target: "_blank" }),
		{ metaKey: true },
	);
	const other = click(
		anchor("https://example.com/invite/flock", { target: "_blank" }),
	);
	expect(modified.defaultPrevented).toBe(false);
	expect(other.defaultPrevented).toBe(false);
	expect(routes).toEqual([]);
	for (const event of [modified, other]) event.preventDefault();
});

it("skips anchors whose click a component already handled", () => {
	const { routes } = setup();
	const element = anchor("https://spaces.colibri.social/invite/flock");
	element.addEventListener("click", (event) => event.preventDefault());
	click(element);
	expect(routes).toEqual([]);
});

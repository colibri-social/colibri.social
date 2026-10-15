import "../app.css";
import { Drawer, DrawerContent, TextField } from "@colibri-social/ui";
import { For } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import {
	installKeyboardInset,
	KEYBOARD_PROGRESS_EVENT,
	SHELL_INSET_VAR,
} from "./keyboard-inset";

const KEYBOARD = 300;

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const frame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const settle = async () => {
	for (let index = 0; index < 4; index++) await frame();
};

let dispose: (() => void) | undefined;
let teardown: (() => void) | undefined;

afterEach(() => {
	teardown?.();
	teardown = undefined;
	dispose?.();
	dispose = undefined;
	document.body.innerHTML = "";
});

const mount = async (rows: number) => {
	const host = document.createElement("div");
	document.body.append(host);
	let shell: HTMLDivElement | undefined;
	dispose = render(
		() => (
			<div
				ref={shell}
				data-mobile-shell=""
				style={{ height: `calc(100dvh - var(${SHELL_INSET_VAR}, 0px))` }}
				class="flex flex-col"
			>
				<div class="h-14 shrink-0">Header</div>
				<div data-keyboard-follow="" class="flex min-h-0 flex-1 flex-col">
					<div class="min-h-0 flex-1">Messages</div>
					<div class="h-12 shrink-0">Composer</div>
				</div>
				<Drawer initialOpen>
					<DrawerContent title="Rename">
						<For each={Array.from({ length: rows }, (_, index) => index)}>
							{(index) => <div class="h-12 shrink-0">Row {index}</div>}
						</For>
						<TextField label="Name" placeholder="Name" />
					</DrawerContent>
				</Drawer>
			</div>
		),
		host,
	);
	teardown = installKeyboardInset({ shell: () => shell });
	await until(() => !!input());
	await new Promise((resolve) => setTimeout(resolve, 700));
	input()?.focus({ preventScroll: true });
	await settle();
};

const input = () =>
	document.querySelector<HTMLInputElement>("[data-corvu-drawer-content] input");

const drawer = () =>
	document.querySelector<HTMLElement>(
		"[data-corvu-drawer-content]",
	) as HTMLElement;

const shell = () =>
	document.querySelector<HTMLElement>("[data-mobile-shell]") as HTMLElement;

const follower = () =>
	document.querySelector<HTMLElement>("[data-keyboard-follow]") as HTMLElement;

const progress = (detail: Record<string, unknown>) =>
	window.dispatchEvent(new CustomEvent(KEYBOARD_PROGRESS_EVENT, { detail }));

const commit = (inset: number) =>
	window.dispatchEvent(
		new CustomEvent("colibri-keyboard-inset", { detail: inset }),
	);

const steps = (from: number, to: number) =>
	Array.from(
		{ length: 10 },
		(_, index) => from + ((to - from) * (index + 1)) / 10,
	);

const overlayTop = () =>
	Number.parseFloat(
		getComputedStyle(document.documentElement).getPropertyValue(
			"--overlay-top",
		),
	) || 0;

const appGeometry = () => ({
	shell: shell().getBoundingClientRect().height,
	follower: follower().getBoundingClientRect().top,
	transform: follower().style.transform,
});

const animate = async (from: number, to: number) => {
	const before = appGeometry();
	progress({ phase: "start", from, to });
	await frame();
	for (const inset of steps(from, to)) {
		progress({ phase: "progress", inset });
		await frame();
		expect(appGeometry()).toEqual(before);
	}
	commit(to);
	await settle();
	expect(appGeometry()).toEqual(before);
};

const expectAboveKeyboard = (inset: number) => {
	const box = drawer().getBoundingClientRect();
	expect(
		Math.abs(box.bottom - (window.innerHeight - inset)),
	).toBeLessThanOrEqual(1);
	expect(box.top).toBeGreaterThanOrEqual(overlayTop() - 1);
	const field = (input() as HTMLInputElement).getBoundingClientRect();
	expect(field.top).toBeGreaterThanOrEqual(box.top);
	expect(field.bottom).toBeLessThanOrEqual(window.innerHeight - inset + 1);
};

it("lifts a short drawer above the keyboard and keeps the app still", async () => {
	await mount(2);
	await animate(0, KEYBOARD);
	expectAboveKeyboard(KEYBOARD);
	expect(drawer().style.translate).toBe("");
	expect(document.documentElement.style.getPropertyValue(SHELL_INSET_VAR)).toBe(
		"",
	);
	await animate(KEYBOARD, 0);
	expectAboveKeyboard(0);
	expect(drawer().style.getPropertyValue("--keyboard-lift")).toBe("");
});

it("moves the drawer with compositor transforms during the animation", async () => {
	await mount(2);
	const rest = drawer().getBoundingClientRect().bottom;
	progress({ phase: "start", from: 0, to: KEYBOARD });
	await frame();
	progress({ phase: "progress", inset: 120 });
	await frame();
	expect(drawer().style.translate).toBe("0px -120px");
	expect(Math.round(drawer().getBoundingClientRect().bottom)).toBe(
		Math.round(rest - 120),
	);
	commit(KEYBOARD);
	await settle();
	expect(drawer().style.translate).toBe("");
});

it("shrinks a tall drawer to fit above the keyboard with the input visible", async () => {
	await mount(40);
	await animate(0, KEYBOARD);
	expectAboveKeyboard(KEYBOARD);
	await new Promise((resolve) => setTimeout(resolve, 200));
	const field = (input() as HTMLInputElement).getBoundingClientRect();
	expect(field.bottom).toBeLessThanOrEqual(window.innerHeight - KEYBOARD + 1);
	expect(field.top).toBeGreaterThanOrEqual(overlayTop());
});

it("keeps the app still when the keyboard closes after the input blurs", async () => {
	await mount(2);
	await animate(0, KEYBOARD);
	input()?.blur();
	await animate(KEYBOARD, 0);
	expectAboveKeyboard(0);
});

it("resets the app when the keyboard closes inside a drawer it opened for", async () => {
	await mount(2);
	input()?.blur();
	await settle();
	const fullHeight = shell().getBoundingClientRect().height;
	progress({ phase: "start", from: 0, to: KEYBOARD });
	await frame();
	commit(KEYBOARD);
	await settle();
	expect(shell().getBoundingClientRect().height).toBe(fullHeight - KEYBOARD);
	input()?.focus({ preventScroll: true });
	await settle();
	progress({ phase: "start", from: KEYBOARD, to: 0 });
	await frame();
	commit(0);
	await settle();
	expect(shell().getBoundingClientRect().height).toBe(fullHeight);
	expect(follower().style.transform).toBe("");
});

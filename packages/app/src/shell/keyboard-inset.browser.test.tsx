import { KEYBOARD_LIFT_ATTRIBUTE, KEYBOARD_LIFT_VAR } from "@colibri-social/ui";
import { afterEach, expect, it } from "vitest";
import {
	installKeyboardInset,
	KEYBOARD_INSET_VAR,
	SHELL_INSET_VAR,
	springSamples,
} from "./keyboard-inset";

const frame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const inset = () =>
	document.documentElement.style.getPropertyValue(KEYBOARD_INSET_VAR);

const dispatch = (detail: unknown) =>
	window.dispatchEvent(new CustomEvent("colibri-keyboard-inset", { detail }));

let teardown: (() => void) | undefined;
let shell: HTMLDivElement | undefined;

afterEach(() => {
	teardown?.();
	teardown = undefined;
	shell?.remove();
});

const install = () => {
	shell = document.createElement("div");
	shell.style.height = "calc(100dvh - var(--keyboard-inset, 0px))";
	document.body.append(shell);
	const target = shell;
	teardown = installKeyboardInset({ shell: () => target });
	return target;
};

it("coalesces per-frame Android insets into one write per frame", async () => {
	install();
	dispatch(120);
	dispatch(180);
	dispatch(240);
	expect(inset()).toBe("");
	await frame();
	expect(inset()).toBe("240px");
	expect(document.documentElement.hasAttribute("data-keyboard-open")).toBe(
		true,
	);
	dispatch(0);
	await frame();
	expect(inset()).toBe("0px");
	expect(document.documentElement.hasAttribute("data-keyboard-open")).toBe(
		false,
	);
});

it("applies an iOS spring once and animates the shell with Web Animations", async () => {
	const target = install();
	dispatch({
		inset: 300,
		duration: 383,
		mass: 1,
		stiffness: 555.0265,
		damping: 47.118,
		velocity: 0,
		latency: 4,
		at: performance.now(),
	});
	expect(inset()).toBe("300px");
	const running = target.getAnimations();
	expect(running).toHaveLength(1);
	const keyframes =
		running[0]?.effect instanceof KeyframeEffect
			? running[0].effect.getKeyframes()
			: [];
	expect(String(keyframes.at(0)?.height)).toMatch(/^calc\(100dvh [-+] 0px\)$/);
	expect(String(keyframes.at(-1)?.height)).toMatch(/^calc\(100dvh - 300px\)$/);
	await frame();
	expect(inset()).toBe("300px");
});

it("lifts a drawer focused while the keyboard stays open and clears it on focus back to the shell", async () => {
	const target = install();
	const composer = document.createElement("textarea");
	target.append(composer);
	composer.focus({ preventScroll: true });
	dispatch(300);
	await frame();
	const drawer = document.createElement("div");
	drawer.setAttribute(KEYBOARD_LIFT_ATTRIBUTE, "");
	const search = document.createElement("input");
	drawer.append(search);
	document.body.append(drawer);
	search.focus({ preventScroll: true });
	expect(drawer.style.getPropertyValue(KEYBOARD_LIFT_VAR)).toBe("300px");
	expect(document.documentElement.style.getPropertyValue(SHELL_INSET_VAR)).toBe(
		"300px",
	);
	composer.focus({ preventScroll: true });
	expect(drawer.style.getPropertyValue(KEYBOARD_LIFT_VAR)).toBe("");
	expect(document.documentElement.style.getPropertyValue(SHELL_INSET_VAR)).toBe(
		"300px",
	);
	drawer.remove();
});

it("clamps reported insets and removes the variable on teardown", async () => {
	install();
	dispatch(window.innerHeight * 5);
	await frame();
	expect(Number.parseFloat(inset())).toBeLessThanOrEqual(
		window.innerHeight * 0.7,
	);
	teardown?.();
	teardown = undefined;
	expect(inset()).toBe("");
});

it("samples a critically damped spring from 0 to 1", () => {
	const samples = springSamples({
		inset: 300,
		duration: 383,
		mass: 1,
		stiffness: 555.0265,
		damping: 47.118,
		velocity: 0,
		latency: 0,
		at: 0,
	});
	expect(samples[0]).toBe(0);
	expect(samples.at(-1)).toBe(1);
	for (let index = 1; index < samples.length; index++) {
		expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1] ?? 0);
	}
});

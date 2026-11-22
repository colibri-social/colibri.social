import {
	KEYBOARD_LIFT_ATTRIBUTE,
	KEYBOARD_LIFT_VAR,
	KEYBOARD_OFFSET_EVENT,
} from "@colibri-social/ui";
import { afterEach, expect, it } from "vitest";
import {
	installKeyboardInset,
	KEYBOARD_INSET_VAR,
	KEYBOARD_PROGRESS_EVENT,
	keyboardPanelHeight,
	reserveKeyboardSpace,
	SHELL_INSET_VAR,
	springSamples,
} from "./keyboard-inset";

const frame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

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

const shellInset = () =>
	document.documentElement.style.getPropertyValue(SHELL_INSET_VAR);

const released = () => {
	let count = 0;
	return {
		done: () => {
			count++;
		},
		count: () => count,
	};
};

const until = async (check: () => boolean, timeout = 2000) => {
	const start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("Timed out");
		await frame();
	}
};

it("remembers the last open keyboard height for the emoji panel", async () => {
	install();
	dispatch(280);
	await frame();
	await settle();
	dispatch(0);
	await frame();
	expect(keyboardPanelHeight()).toBe(280);
});

it("ignores the opening target when remembering the keyboard height", async () => {
	install();
	window.dispatchEvent(
		new CustomEvent("colibri-keyboard-progress", {
			detail: { phase: "start", from: 0, to: 370 },
		}),
	);
	dispatch(336);
	await frame();
	await settle();
	dispatch(0);
	await frame();
	expect(keyboardPanelHeight()).toBe(336);
});

it("ignores a height the keyboard reports only briefly", async () => {
	install();
	dispatch(336);
	await frame();
	await settle();
	dispatch(370);
	await frame();
	dispatch(0);
	await frame();
	await settle();
	expect(keyboardPanelHeight()).toBe(336);
});

it("holds the shell inset while the keyboard closes under a reserved panel", async () => {
	install();
	dispatch(300);
	await frame();
	const signal = released();
	const reservation = reserveKeyboardSpace(300, signal.done);
	dispatch(0);
	await frame();
	expect(shellInset()).toBe("300px");
	expect(document.documentElement.hasAttribute("data-keyboard-open")).toBe(
		true,
	);
	reservation.release();
	expect(shellInset()).toBe("0px");
	await until(() => signal.count() === 1);
});

it("slides the shell and the panel up together when the keyboard is closed", async () => {
	const target = install();
	const panel = document.createElement("div");
	panel.setAttribute("data-keyboard-panel", "");
	document.body.append(panel);
	const signal = released();
	const reservation = reserveKeyboardSpace(260, signal.done);
	expect(shellInset()).toBe("260px");
	expect(target.getAnimations()).toHaveLength(1);
	const keyframes = panel
		.getAnimations()
		.map((running) =>
			running.effect instanceof KeyframeEffect
				? running.effect.getKeyframes()
				: [],
		)[0];
	expect(String(keyframes?.at(0)?.transform)).toBe(
		"translate3d(0px, 260px, 0px)",
	);
	expect(String(keyframes?.at(-1)?.transform)).toBe(
		"translate3d(0px, 0px, 0px)",
	);
	reservation.release();
	await until(() => signal.count() === 1);
	panel.remove();
});

it("keeps the panel space until the rising keyboard reaches it", async () => {
	install();
	const signal = released();
	const reservation = reserveKeyboardSpace(300, signal.done);
	reservation.release({ untilKeyboard: true });
	dispatch(120);
	await frame();
	expect(shellInset()).toBe("300px");
	expect(signal.count()).toBe(0);
	dispatch(320);
	await frame();
	expect(shellInset()).toBe("300px");
	await settle();
	expect(shellInset()).toBe("320px");
	await settle();
	await settle();
	await settle();
	expect(signal.count()).toBe(1);
});

it("holds the panel height through a keyboard that overshoots and settles", async () => {
	install();
	const signal = released();
	const reservation = reserveKeyboardSpace(336, signal.done);
	reservation.release({ untilKeyboard: true });
	dispatch(370);
	await frame();
	expect(shellInset()).toBe("336px");
	dispatch(336);
	await frame();
	await settle();
	expect(shellInset()).toBe("336px");
	expect(signal.count()).toBe(1);
});

it("holds the panel height when the picker opens over a rising keyboard", async () => {
	install();
	dispatch(370);
	await frame();
	const signal = released();
	reserveKeyboardSpace(336, signal.done);
	await frame();
	expect(shellInset()).toBe("336px");
	dispatch(0);
	await frame();
	expect(shellInset()).toBe("336px");
});

it("stacks the search strip on top of the keyboard while the panel searches", async () => {
	install();
	const signal = released();
	const reservation = reserveKeyboardSpace(300, signal.done);
	reservation.setStacked(176);
	expect(shellInset()).toBe("300px");
	dispatch(300);
	await frame();
	expect(shellInset()).toBe("476px");
	reservation.setStacked(0);
	expect(shellInset()).toBe("300px");
	reservation.release();
	await until(() => signal.count() === 1);
});

it("announces the Android follow offset on every frame and zero at the commit", async () => {
	const target = install();
	const follower = document.createElement("div");
	follower.setAttribute("data-keyboard-follow", "");
	target.append(follower);
	const seen: number[] = [];
	const record = (event: Event) => {
		if (event.target === follower)
			seen.push((event as CustomEvent<number>).detail);
	};
	window.addEventListener(KEYBOARD_OFFSET_EVENT, record);
	const progress = (detail: unknown) =>
		window.dispatchEvent(new CustomEvent(KEYBOARD_PROGRESS_EVENT, { detail }));
	progress({ phase: "start", from: 0, to: 300 });
	progress({ phase: "progress", inset: 100.4 });
	progress({ phase: "progress", inset: 300 });
	expect(follower.style.transform).toBe("translate3d(0px, -300px, 0px)");
	dispatch(300);
	await frame();
	window.removeEventListener(KEYBOARD_OFFSET_EVENT, record);
	expect(seen).toEqual([0, 100, 300, 0]);
	expect(follower.style.transform).toBe("");
	expect(inset()).toBe("300px");
});

it("clears the open attribute when a dialog closes before the keyboard", async () => {
	install();
	const dialog = document.createElement("div");
	dialog.setAttribute("role", "dialog");
	const field = document.createElement("input");
	dialog.append(field);
	document.body.append(dialog);
	field.focus({ preventScroll: true });
	dispatch(300);
	await frame();
	expect(document.documentElement.hasAttribute("data-keyboard-open")).toBe(
		true,
	);
	dialog.remove();
	window.dispatchEvent(
		new CustomEvent(KEYBOARD_PROGRESS_EVENT, {
			detail: { phase: "start", from: 300, to: 0 },
		}),
	);
	dispatch(0);
	await frame();
	expect(document.documentElement.hasAttribute("data-keyboard-open")).toBe(
		false,
	);
});

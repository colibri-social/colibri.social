import { afterEach, expect, it, vi } from "vitest";
import { installTapGuard } from "./tap-guard";

let uninstall: (() => void) | undefined;
let button: HTMLButtonElement | undefined;

afterEach(() => {
	uninstall?.();
	button?.remove();
});

const touch = (target: Element, type: string, x: number, y: number) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			pointerType: "touch",
			isPrimary: true,
			clientX: x,
			clientY: y,
			bubbles: true,
		}),
	);

const setup = () => {
	uninstall = installTapGuard();
	button = document.createElement("button");
	document.body.append(button);
	const onClick = vi.fn();
	button.addEventListener("click", onClick);
	return { target: button, onClick };
};

it("lets a still tap through", () => {
	const { target, onClick } = setup();
	touch(target, "pointerdown", 50, 50);
	touch(target, "pointermove", 54, 52);
	target.click();
	expect(onClick).toHaveBeenCalledOnce();
});

it("cancels a tap once the finger has moved", () => {
	const { target, onClick } = setup();
	touch(target, "pointerdown", 50, 50);
	touch(target, "pointermove", 50, 70);
	target.click();
	expect(onClick).not.toHaveBeenCalled();
});

it("leaves mouse clicks alone", () => {
	const { target, onClick } = setup();
	target.dispatchEvent(
		new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }),
	);
	target.click();
	expect(onClick).toHaveBeenCalledOnce();
});

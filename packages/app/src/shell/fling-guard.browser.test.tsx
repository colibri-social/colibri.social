import { afterEach, expect, it } from "vitest";
import { installFlingGuard } from "./fling-guard";

let uninstall: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	uninstall?.();
	host?.remove();
});

const touchAt = (target: Element, x: number, y: number) =>
	new Touch({ identifier: 1, target, clientX: x, clientY: y });

const gesture = (
	target: Element,
	from: [number, number],
	to: [number, number],
) => {
	const start = touchAt(target, ...from);
	target.dispatchEvent(
		new TouchEvent("touchstart", {
			bubbles: true,
			cancelable: true,
			touches: [start],
			targetTouches: [start],
			changedTouches: [start],
		}),
	);
	const end = touchAt(target, ...to);
	const move = new TouchEvent("touchmove", {
		bubbles: true,
		cancelable: true,
		touches: [end],
		targetTouches: [end],
		changedTouches: [end],
	});
	target.dispatchEvent(move);
	return move.defaultPrevented;
};

const setup = () => {
	uninstall = installFlingGuard();
	host = document.createElement("div");
	host.innerHTML = `
		<div data-still style="height:100px">still</div>
		<div data-scroller style="height:100px;overflow-y:auto">
			<div data-row style="height:400px">rows</div>
		</div>
		<div data-strip style="width:100px;overflow-x:auto">
			<div data-wide style="width:400px;height:20px">wide</div>
		</div>
		<input data-input />
	`;
	document.body.append(host);
	const pick = (name: string) =>
		host?.querySelector(`[data-${name}]`) as HTMLElement;
	return pick;
};

it("cancels a swipe over content that can't scroll", () => {
	const pick = setup();
	expect(gesture(pick("still"), [50, 50], [50, 10])).toBe(true);
	expect(gesture(pick("still"), [50, 50], [90, 52])).toBe(true);
});

it("leaves a swipe that scrolls a list alone", () => {
	const pick = setup();
	expect(gesture(pick("row"), [50, 80], [50, 20])).toBe(false);
});

it("cancels a swipe past the end of a list", () => {
	const pick = setup();
	expect(gesture(pick("row"), [50, 20], [50, 80])).toBe(true);
	(pick("scroller") as HTMLElement).scrollTop = 120;
	expect(gesture(pick("row"), [50, 20], [50, 80])).toBe(false);
});

it("leaves horizontal scrollers and inputs alone", () => {
	const pick = setup();
	expect(gesture(pick("wide"), [80, 10], [20, 12])).toBe(false);
	expect(gesture(pick("input"), [10, 10], [60, 10])).toBe(false);
});

it("ignores movement inside the slop", () => {
	const pick = setup();
	expect(gesture(pick("still"), [50, 50], [52, 51])).toBe(false);
});

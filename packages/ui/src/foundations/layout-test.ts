import { expect } from "storybook/test";

const CONTROL_SELECTOR =
	'button, a[href], input, select, textarea, [role="switch"], [role="checkbox"], [data-layout-check]';

const SCROLLING_INPUT_TYPES = new Set([
	"text",
	"search",
	"email",
	"url",
	"tel",
	"password",
]);

const scrollsItsValue = (element: Element) =>
	element instanceof HTMLInputElement &&
	SCROLLING_INPUT_TYPES.has(element.type);

const visuallyHidden = (element: Element) => {
	const style = getComputedStyle(element);
	return (
		style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)"
	);
};

export type LayoutIssue = {
	element: string;
	problem: string;
};

const describe = (element: Element) => {
	const label =
		element.getAttribute("aria-label") ??
		element.textContent?.trim().slice(0, 40) ??
		"";
	return `${element.tagName.toLowerCase()} "${label}"`;
};

export const layoutIssues = (
	container: HTMLElement,
	options: { inset?: number } = {},
): LayoutIssue[] => {
	const issues: LayoutIssue[] = [];
	const box = container.getBoundingClientRect();
	const inset = options.inset ?? 0;
	const viewport = {
		left: 0,
		top: 0,
		right: document.documentElement.clientWidth,
		bottom: document.documentElement.clientHeight,
	};
	for (const element of container.querySelectorAll<HTMLElement>("*")) {
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) continue;
		if (getComputedStyle(element).position === "fixed") continue;
		if (visuallyHidden(element)) continue;
		if (element.parentElement?.closest("[data-layout-clip]")) continue;
		if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) {
			issues.push({
				element: describe(element),
				problem: `overflows its container by ${Math.round(Math.max(box.left - rect.left, rect.right - box.right))}px`,
			});
		}
	}
	for (const element of [
		container,
		...container.querySelectorAll<HTMLElement>("*"),
	]) {
		const style = getComputedStyle(element);
		const clips =
			style.overflowX === "hidden" ||
			style.overflowX === "clip" ||
			style.overflowY === "hidden" ||
			style.overflowY === "clip";
		if (!clips) continue;
		if (style.textOverflow === "ellipsis") continue;
		if (style.webkitLineClamp && style.webkitLineClamp !== "none") continue;
		if (element.closest("[data-layout-clip]")) continue;
		if (scrollsItsValue(element)) continue;
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) continue;
		if (element.clientWidth <= 1 || element.clientHeight <= 1) continue;
		const clippedY =
			(style.overflowY === "hidden" || style.overflowY === "clip") &&
			element.scrollHeight > element.clientHeight + 1;
		const clippedX =
			(style.overflowX === "hidden" || style.overflowX === "clip") &&
			element.scrollWidth > element.clientWidth + 1;
		if (clippedY || clippedX) {
			issues.push({
				element: describe(element),
				problem: `clips its content (${element.scrollWidth}x${element.scrollHeight} in ${element.clientWidth}x${element.clientHeight})`,
			});
		}
	}
	for (const control of container.querySelectorAll<HTMLElement>(
		CONTROL_SELECTOR,
	)) {
		const rect = control.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) continue;
		if (visuallyHidden(control)) continue;
		if (
			rect.left < box.left + inset - 0.5 ||
			rect.right > box.right - inset + 0.5
		) {
			issues.push({
				element: describe(control),
				problem: `sits outside its container (${Math.round(rect.left - box.left)}px to ${Math.round(box.right - rect.right)}px from the edges)`,
			});
		}
		if (rect.left < viewport.left - 0.5 || rect.right > viewport.right + 0.5) {
			issues.push({
				element: describe(control),
				problem: "is cut off by the viewport",
			});
		}
		if (
			!scrollsItsValue(control) &&
			control.scrollWidth > control.clientWidth + 1
		) {
			const style = getComputedStyle(control);
			if (style.textOverflow !== "ellipsis") {
				issues.push({
					element: describe(control),
					problem: "label overflows the control",
				});
			}
		}
	}
	return issues;
};

export const expectNoLayoutIssues = async (
	container: HTMLElement,
	options: { inset?: number } = {},
) => {
	await expect(layoutIssues(container, options)).toEqual([]);
};

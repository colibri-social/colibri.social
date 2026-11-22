import { expect, userEvent } from "storybook/test";

export type RingClip = {
	clipper: Element;
	left: number;
	right: number;
	top: number;
	bottom: number;
};

const CLIPPING_CONTAIN = /paint|strict|content/;

const ringReach = (element: Element) => {
	const style = getComputedStyle(element);
	if (style.outlineStyle === "none") return 0;
	const width = Number.parseFloat(style.outlineWidth) || 0;
	const offset = Number.parseFloat(style.outlineOffset) || 0;
	return Math.max(0, width + offset);
};

export const focusRingClip = (element: Element): RingClip | undefined => {
	const reach = ringReach(element);
	const rect = element.getBoundingClientRect();
	const ring = {
		left: rect.left - reach,
		right: rect.right + reach,
		top: rect.top - reach,
		bottom: rect.bottom + reach,
	};
	for (
		let ancestor = element.parentElement;
		ancestor && ancestor !== document.body;
		ancestor = ancestor.parentElement
	) {
		const style = getComputedStyle(ancestor);
		const containsPaint = CLIPPING_CONTAIN.test(style.contain);
		const clipX = style.overflowX !== "visible" || containsPaint;
		const clipY = style.overflowY !== "visible" || containsPaint;
		if (!clipX && !clipY) continue;
		const box = ancestor.getBoundingClientRect();
		const left = box.left + ancestor.clientLeft - ancestor.scrollLeft;
		const top = box.top + ancestor.clientTop - ancestor.scrollTop;
		const clip = {
			clipper: ancestor,
			left: clipX ? Math.max(0, left - ring.left) : 0,
			right: clipX
				? Math.max(0, ring.right - (left + ancestor.scrollWidth))
				: 0,
			top: clipY ? Math.max(0, top - ring.top) : 0,
			bottom: clipY
				? Math.max(0, ring.bottom - (top + ancestor.scrollHeight))
				: 0,
		};
		const clipped =
			clip.left > 0.5 ||
			clip.right > 0.5 ||
			clip.top > 0.5 ||
			clip.bottom > 0.5;
		return clipped ? clip : undefined;
	}
	return undefined;
};

export const tabTo = async (element: HTMLElement, maxTabs = 60) => {
	for (let step = 0; step < maxTabs; step += 1) {
		if (document.activeElement === element) return;
		await userEvent.tab();
	}
	await expect(document.activeElement).toBe(element);
};

export const expectFocusRingVisible = async (element: HTMLElement) => {
	await tabTo(element);
	await expect(element.matches(":focus-visible")).toBe(true);
	const style = getComputedStyle(element);
	await expect(style.outlineStyle).not.toBe("none");
	await expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0);
	await expect(focusRingClip(element)).toBeUndefined();
};

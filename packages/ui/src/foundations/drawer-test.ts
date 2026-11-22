import { expect, screen, waitFor } from "storybook/test";

const settledOffset = (element: HTMLElement) => {
	const transform = getComputedStyle(element).transform;
	if (!transform || transform === "none") return 0;
	return new DOMMatrixReadOnly(transform).m42;
};

export const findSettledDrawer = (name: string | RegExp) =>
	waitFor(
		() => {
			const drawer = screen.getByRole("dialog", { name });
			expect(drawer).toHaveAttribute("data-open");
			expect(drawer).not.toHaveAttribute("data-transitioning");
			expect(Math.abs(settledOffset(drawer))).toBeLessThanOrEqual(0.5);
			return drawer;
		},
		{ timeout: 3000 },
	);

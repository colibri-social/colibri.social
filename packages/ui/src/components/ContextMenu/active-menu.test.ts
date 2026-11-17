import { describe, expect, it, vi } from "vitest";
import {
	addOpenOverlay,
	claimActiveMenu,
	closeAllOverlays,
	hasActiveMenu,
	releaseActiveMenu,
} from "./active-menu";

describe("closeAllOverlays", () => {
	it("closes every open overlay, nested ones included", () => {
		const closePopover = vi.fn();
		const closeMenu = vi.fn();

		addOpenOverlay(closePopover);
		addOpenOverlay(closeMenu);
		closeAllOverlays();

		expect(closePopover).toHaveBeenCalledOnce();
		expect(closeMenu).toHaveBeenCalledOnce();
	});

	it("forgets overlays once it closed them", () => {
		const close = vi.fn();

		addOpenOverlay(close);
		closeAllOverlays();
		closeAllOverlays();

		expect(close).toHaveBeenCalledOnce();
	});

	it("skips overlays that were removed", () => {
		const close = vi.fn();
		const remove = addOpenOverlay(close);

		remove();
		closeAllOverlays();

		expect(close).not.toHaveBeenCalled();
	});

	it("keeps an overlay that opens while another one closes", () => {
		const reopened = vi.fn();

		addOpenOverlay(() => addOpenOverlay(reopened));
		closeAllOverlays();

		expect(reopened).not.toHaveBeenCalled();

		closeAllOverlays();

		expect(reopened).toHaveBeenCalledOnce();
	});

	it("leaves the active menu slot alone", () => {
		const closeMenu = vi.fn();

		claimActiveMenu(closeMenu);
		closeAllOverlays();

		expect(hasActiveMenu()).toBe(true);
		expect(closeMenu).not.toHaveBeenCalled();

		releaseActiveMenu(closeMenu);
	});
});

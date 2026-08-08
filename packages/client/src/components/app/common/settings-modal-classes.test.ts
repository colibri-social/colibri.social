import { describe, expect, it } from "vitest";
import { cx } from "../../../utils/cva";
import { dialogContentClass } from "../../ui/dialog-classes";
import {
	settingsShellClass,
	userSettingsShellClass,
} from "./settings-modal-classes";

const resolve = (contentClass?: string) =>
	cx(dialogContentClass, cx(settingsShellClass, contentClass)).split(" ");

describe("settings modal shell classes", () => {
	const shells = [
		["shared settings modals", resolve()] as const,
		["user settings modal", resolve(userSettingsShellClass)] as const,
	];

	for (const [name, classes] of shells) {
		describe(name, () => {
			it("never scrolls, so it cannot stack a second scrollbar on the page scroller", () => {
				expect(classes).toContain("overflow-hidden");
			});

			it("drops the overflow inherited from the dialog primitive", () => {
				expect(classes).not.toContain("overflow-y-auto");
				expect(classes).not.toContain("overflow-y-scroll");
				expect(classes).not.toContain("overflow-auto");
			});

			it("uses a single definite height instead of a pinned min/max pair", () => {
				const heights = classes.filter((c) => c.startsWith("h-["));
				expect(heights).toHaveLength(1);
				expect(classes.filter((c) => c.startsWith("min-h-["))).toHaveLength(0);
			});

			it("sizes against the dialog positioner rather than the raw viewport", () => {
				for (const c of classes) {
					expect(c).not.toContain("100vh");
				}
			});

			it("keeps a floor of zero so flex children can shrink", () => {
				expect(classes).toContain("min-h-0");
			});
		});
	}

	it("lets the user settings modal raise the shared height", () => {
		expect(resolve()).toContain("h-[min(36rem,100%)]");
		expect(resolve(userSettingsShellClass)).toContain("h-[min(48rem,100%)]");
	});
});

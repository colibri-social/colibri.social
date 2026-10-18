import { describe, expect, it } from "vitest";
import type { Screen } from "./screen/define";

const screens = import.meta.glob<{ default: Screen<unknown> }>(
	"./screens/**/*.screen.ts",
	{ eager: true },
);

describe("screen parity", () => {
	it("finds every screen", () => {
		expect(Object.keys(screens).length).toBeGreaterThanOrEqual(5);
	});

	for (const [path, module] of Object.entries(screens)) {
		const screen = module.default;
		describe(screen.contract.id, () => {
			it(`has a mobile view (${path})`, () => {
				expect(screen.variants.mobile).toBeTypeOf("function");
			});

			it(`has a desktop view (${path})`, () => {
				expect(screen.variants.desktop).toBeTypeOf("function");
			});

			for (const platform of ["mobile", "desktop"] as const) {
				it(`only omits real slots on ${platform}`, async () => {
					const load = screen.variants[platform];
					if (!load) return;
					const view = (await load()).default;
					const names = new Set(screen.contract.slotNames);
					for (const name of [...view.omitted, ...view.hidden]) {
						expect(names.has(name)).toBe(true);
					}
				});
			}
		});
	}
});

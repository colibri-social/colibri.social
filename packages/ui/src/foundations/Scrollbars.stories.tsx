import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";

const meta = {
	title: "Foundations/Scrollbars",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const collectRules = (rules: CSSRuleList, into: CSSRule[] = []) => {
	for (const rule of Array.from(rules)) {
		into.push(rule);
		if ("cssRules" in rule)
			collectRules((rule as CSSGroupingRule).cssRules, into);
	}
	return into;
};

const allRules = () =>
	Array.from(document.styleSheets).flatMap((sheet) => {
		try {
			return collectRules(sheet.cssRules);
		} catch {
			return [];
		}
	});

const styleFor = (selector: string) =>
	allRules().find(
		(rule): rule is CSSStyleRule =>
			rule instanceof CSSStyleRule &&
			rule.selectorText === selector &&
			rule.parentRule instanceof CSSMediaRule &&
			rule.parentRule.conditionText === "(pointer: fine)",
	)?.style;

const Lines = () => (
	<div class="h-[480px] w-[480px] p-2 text-sm">
		<button type="button">Start</button>
		{Array.from({ length: 30 }, (_, index) => (
			<p class="m-0">Line {index + 1}</p>
		))}
	</div>
);

export const ThinTokenScrollbars: Story = {
	render: () => (
		<div class="flex gap-4 bg-background p-6 text-foreground">
			<section
				aria-label="Default scrollbar"
				data-testid="default"
				class="h-40 w-64 overflow-auto bg-card"
			>
				<Lines />
			</section>
			<section
				aria-label="Hidden scrollbar"
				data-testid="hidden"
				class="h-40 w-64 overflow-auto bg-card [scrollbar-width:none]"
			>
				<Lines />
			</section>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const thumb = styleFor("::-webkit-scrollbar-thumb");
		if (!thumb) throw new Error("scrollbar thumb rule missing");
		await expect(thumb.backgroundColor).toBe("var(--accent)");
		await expect(thumb.borderRadius).toBe("9999px");
		await expect(thumb.backgroundClip).toBe("padding-box");
		await expect(
			styleFor(
				"::-webkit-scrollbar-thumb:hover, ::-webkit-scrollbar-thumb:active",
			)?.backgroundColor,
		).toBe("var(--muted-foreground)");
		await expect(styleFor("::-webkit-scrollbar")?.width).toBe("10px");

		const standard = allRules().find(
			(rule): rule is CSSStyleRule =>
				rule instanceof CSSStyleRule &&
				rule.selectorText === "*" &&
				rule.style.scrollbarWidth === "thin",
		);
		await expect(standard?.style.scrollbarColor).toBe(
			"var(--accent) transparent",
		);
		await expect(standard?.parentRule?.cssText).toContain(
			"not selector(::-webkit-scrollbar)",
		);

		await expect(
			getComputedStyle(canvas.getByTestId("default")).scrollbarWidth,
		).toBe("auto");
		await expect(
			getComputedStyle(canvas.getByTestId("hidden")).scrollbarWidth,
		).toBe("none");
	},
};

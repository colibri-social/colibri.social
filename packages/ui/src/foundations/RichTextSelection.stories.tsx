import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { build, f, mark } from "../components/RichText/fixtures";
import { RichTextRenderer } from "../components/RichText/RichText";

const meta = {
	title: "Foundations/Rich text selection",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const VALUE = build([
	"Read ",
	mark("https://colibri.social", f.link("https://colibri.social")),
	" today",
]);

export const FullWidthWithUndraggableLinks: Story = {
	render: () => (
		<div class="flex w-[480px] items-start bg-background p-6 text-foreground">
			<RichTextRenderer data-testid="content" value={VALUE} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const content = within(canvasElement).getByTestId("content");
		const style = getComputedStyle(content);
		await expect(style.display).toBe("block");
		await expect(style.userSelect).toBe("text");
		const frame = content.parentElement as HTMLElement;
		const inner =
			frame.clientWidth -
			Number.parseFloat(getComputedStyle(frame).paddingLeft) -
			Number.parseFloat(getComputedStyle(frame).paddingRight);
		await expect(content.getBoundingClientRect().width).toBeCloseTo(inner, 0);

		const link = content.querySelector("a");
		if (!link) throw new Error("link missing");
		await expect(
			getComputedStyle(link).getPropertyValue("-webkit-user-drag"),
		).toBe("none");
	},
};

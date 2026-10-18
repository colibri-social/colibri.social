import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../components/Button/Button";
import { RichTextRenderer } from "../components/RichText/RichText";
import { TextField } from "../components/TextField/TextField";

const meta = {
	title: "Foundations/Text selection",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const userSelect = (element: Element) => {
	const style = getComputedStyle(element);
	return style.userSelect || style.getPropertyValue("-webkit-user-select");
};

export const ChromeVersusContent: Story = {
	render: () => (
		<div class="flex max-w-sm flex-col gap-4 bg-background p-6">
			<p data-testid="label" class="m-0 text-sm font-semibold">
				Channel settings
			</p>
			<Button variant="secondary">Mark as read</Button>
			<RichTextRenderer
				data-testid="content"
				value={{ text: "Message text you can copy.", facets: [] }}
			/>
			<TextField label="Display name" defaultValue="Kris" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(userSelect(canvas.getByTestId("label"))).toBe("none");
		await expect(
			userSelect(canvas.getByRole("button", { name: "Mark as read" })),
		).toBe("none");
		await expect(userSelect(canvas.getByTestId("content"))).toBe("text");
		await expect(
			userSelect(canvas.getByRole("textbox", { name: "Display name" })),
		).toBe("text");
	},
};

import { createSignal } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { DisplayNameField } from "./DisplayNameField";

const meta = {
	title: "Surfaces/Profile editor",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Editor = (props: { platform?: "desktop" | "mobile" }) => {
	const [name, setName] = createSignal("Lou");
	const [color, setColor] = createSignal("#22d3ee");
	return (
		<div class="flex w-[370px] flex-col gap-4 p-4 text-foreground">
			<DisplayNameField
				value={name()}
				onChange={setName}
				nameColor={color()}
				onNameColorChange={setColor}
				platform={props.platform}
			/>
			<output data-profile-output="">{`${name()} ${color()}`}</output>
		</div>
	);
};

export const NameColor: Story = {
	render: () => <Editor />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: "Display name" });
		const output = () =>
			canvasElement.querySelector("[data-profile-output]")?.textContent ?? "";

		await step("The name previews in its color", async () => {
			await expect(getComputedStyle(input).color).toBe("rgb(34, 211, 238)");
		});

		await step("The swatch sits next to the input", async () => {
			const swatch = canvas.getByRole("button", { name: /^Name color/ });
			const swatchBox = swatch.getBoundingClientRect();
			await expect(Math.round(swatchBox.width)).toBe(40);
			await expect(Math.round(swatchBox.height)).toBe(40);
			const field = input.closest(".group\\/field") as HTMLElement;
			await expect(
				Math.round(swatchBox.left - field.getBoundingClientRect().right),
			).toBe(16);
		});

		await step("Picking a color persists through onChange", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: /^Name color/ }),
			);
			const dialog = await screen.findByRole("dialog", { name: "Name color" });
			await userEvent.click(
				within(dialog).getByRole("button", { name: "#f59e0b" }),
			);
			await waitFor(() => expect(output()).toBe("Lou #f59e0b"));
			await expect(getComputedStyle(input).color).toBe("rgb(245, 158, 11)");
			await userEvent.keyboard("{Escape}");
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		});
	},
};

export const NameColorMobile: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Editor platform="mobile" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /^Name color/ }),
		);
		await expect(
			await screen.findByRole("dialog", { name: "Name color" }),
		).toBeVisible();
	},
};

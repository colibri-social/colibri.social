import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

const meta = {
	title: "Overlays/Popover",
	component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
	render: () => (
		<div class="flex min-h-[300px] items-start gap-4">
			<Popover>
				<PopoverTrigger as={Button} variant="secondary">
					Open popover
				</PopoverTrigger>
				<PopoverContent title="Pairing code" class="w-64">
					<p class="px-1 pb-1 text-sm">
						Run the connect command in your other app to get a code.
					</p>
				</PopoverContent>
			</Popover>
			<Popover placement="right">
				<PopoverTrigger
					as={IconButton}
					variant="ghost"
					label="More info"
					icon={<InfoCircleIcon />}
				/>
				<PopoverContent class="w-56">
					<p class="px-1 text-sm">Popovers grow out of their trigger.</p>
				</PopoverContent>
			</Popover>
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open popover" }),
		);
		const dialog = await screen.findByRole("dialog");
		await waitFor(() => expect(dialog).toBeVisible());
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const TriggerToggles: Story = {
	render: () => (
		<div class="flex min-h-[300px] items-start gap-4">
			<Popover>
				<PopoverTrigger as={Button} variant="secondary">
					First
				</PopoverTrigger>
				<PopoverContent aria-label="First popover" class="w-56">
					<p class="px-1 text-sm">First popover</p>
				</PopoverContent>
			</Popover>
			<Popover>
				<PopoverTrigger as={Button} variant="secondary">
					Second
				</PopoverTrigger>
				<PopoverContent aria-label="Second popover" class="w-56">
					<p class="px-1 text-sm">Second popover</p>
				</PopoverContent>
			</Popover>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = canvas.getByRole("button", { name: "First" });
		const second = canvas.getByRole("button", { name: "Second" });
		const expanded = () =>
			[...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
				.filter((dialog) => dialog.hasAttribute("data-expanded"))
				.map((dialog) => dialog.getAttribute("aria-label"));
		await userEvent.click(first);
		await waitFor(() => expect(expanded()).toEqual(["First popover"]));
		await userEvent.click(first);
		await waitFor(() => expect(expanded()).toEqual([]));
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect(expanded()).toEqual([]);
		await expect(first).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(first);
		await waitFor(() => expect(expanded()).toEqual(["First popover"]));
		await userEvent.click(second);
		await waitFor(() => expect(expanded()).toEqual(["Second popover"]));
		await userEvent.click(second);
		await waitFor(() => expect(expanded()).toEqual([]));
	},
};

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

import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { StatusScreen } from "./StatusScreen";

type Args = { onBack: () => void; onOther: () => void };

const meta: Meta<Args> = {
	title: "Surfaces/Status screen",
	args: { onBack: fn(), onOther: fn() },
	parameters: { viewport: { defaultViewport: "iphone" } },
};

export default meta;
type Story = StoryObj<Args>;

export const ChannelGone: Story = {
	render: (args) => (
		<div class="flex h-[640px] w-full max-w-[402px] flex-col bg-background">
			<StatusScreen
				icon={<ChatSquareDotsIcon />}
				title="This channel doesn't exist anymore"
				description="It may have been deleted, or you no longer have access to it."
				actions={
					<Button block variant="secondary" onClick={args.onBack}>
						Back to channels
					</Button>
				}
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", {
				name: "This channel doesn't exist anymore",
			}),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Back to channels" }),
		);
		await expect(args.onBack).toHaveBeenCalledOnce();
	},
};

export const SpaceUnavailableLongName: Story = {
	render: (args) => (
		<div class="flex h-[640px] w-full max-w-[320px] flex-col bg-background">
			<StatusScreen
				tone="destructive"
				icon={<DangerTriangleIcon />}
				title="This Space isn't available"
				description="It may have been deleted, or you're no longer a member."
				actions={
					<>
						<Button block onClick={args.onOther}>
							Go to Night Owls Art Club and Friends of the Studio
						</Button>
						<Button block variant="secondary" onClick={args.onBack}>
							Discover Spaces
						</Button>
					</>
				}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

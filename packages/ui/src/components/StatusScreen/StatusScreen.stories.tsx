import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { StatusScreen } from "./StatusScreen";

type Args = {
	onBack: () => void;
	onOther: () => void;
	onCreate: () => void;
	onDiscover: () => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Status screen",
	args: { onBack: fn(), onOther: fn(), onCreate: fn(), onDiscover: fn() },
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

export const NoSpaces: Story = {
	render: (args) => (
		<div class="flex h-[640px] w-full max-w-[402px] flex-col bg-background">
			<StatusScreen
				tone="neutral"
				icon={<UsersGroupRoundedIcon />}
				title="You're not in any Spaces yet"
				description="Create one to start chatting with your friends. If someone sends you an invite link, open it and you'll land right in their Space."
				actions={
					<>
						<Button block onClick={args.onCreate}>
							Create a Space
						</Button>
						<Button block variant="secondary" onClick={args.onDiscover}>
							Discover Spaces
						</Button>
					</>
				}
			/>
		</div>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "You're not in any Spaces yet" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Create a Space" }),
		);
		await expect(args.onCreate).toHaveBeenCalledOnce();
		await userEvent.click(
			canvas.getByRole("button", { name: "Discover Spaces" }),
		);
		await expect(args.onDiscover).toHaveBeenCalledOnce();
	},
};

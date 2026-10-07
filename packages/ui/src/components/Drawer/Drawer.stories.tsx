import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { ChecklistMinimalisticIcon } from "@solar-icons/solid/bold/checklist-minimalistic";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { createSignal, For, type JSX } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ThreadIcon } from "../../icons/custom";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent, DrawerTrigger } from "./Drawer";

const meta = {
	title: "Overlays/Drawer",
	component: Drawer,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

const actions: { icon: JSX.Element; label: string }[] = [
	{ icon: <ChecklistMinimalisticIcon />, label: "Mark as read" },
	{ icon: <BellOffIcon />, label: "Mute channel" },
	{ icon: <ThreadIcon />, label: "Start a thread" },
	{ icon: <ChatRoundDotsIcon />, label: "Show all threads" },
	{ icon: <LinkIcon />, label: "Copy channel link" },
];

const ActionGroup = () => (
	<div class="flex flex-col overflow-hidden rounded-control-lg bg-secondary">
		<For each={actions}>
			{(action, index) => (
				<>
					{index() > 0 && <div class="h-px bg-border" />}
					<button
						type="button"
						class="flex h-10 items-center gap-2 px-3 text-left text-sm font-semibold active:bg-secondary-highlight [&>svg]:size-6"
					>
						{action.icon}
						{action.label}
					</button>
				</>
			)}
		</For>
	</div>
);

export const ContextMenu: Story = {
	render: () => (
		<Drawer>
			<DrawerTrigger as={Button} variant="secondary">
				Open channel menu
			</DrawerTrigger>
			<DrawerContent title="Awesome Channel" titleIcon={<ChatRoundDotsIcon />}>
				<ActionGroup />
				<div class="flex flex-col gap-2 rounded-surface border border-border bg-popover p-3">
					<p class="text-sm">Developer mode</p>
					<div class="flex gap-2">
						<Button variant="secondary" class="flex-1">
							Copy AT-URI
						</Button>
						<Button variant="secondary" class="flex-1">
							Show on PDSls
						</Button>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open channel menu" }),
		);
		const dialog = await screen.findByRole("dialog");
		await expect(within(dialog).getByText("Awesome Channel")).toBeVisible();
		await waitFor(() =>
			expect(dialog).toContainElement(document.activeElement as HTMLElement),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(
			() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			{ timeout: 2000 },
		);
	},
};

export const TallContentScrolls: Story = {
	render: () => (
		<Drawer>
			<DrawerTrigger as={Button} variant="secondary">
				Open long sheet
			</DrawerTrigger>
			<DrawerContent title="Members">
				<For each={Array.from({ length: 40 }, (_, index) => index + 1)}>
					{(index) => (
						<div class="flex h-12 shrink-0 items-center rounded-control-lg bg-secondary px-3 text-sm font-semibold">
							Member {index}
						</div>
					)}
				</For>
			</DrawerContent>
		</Drawer>
	),
};

export const InitiallyOpen: Story = {
	render: () => (
		<Drawer initialOpen>
			<DrawerContent title="Invite people to Awesome Space">
				<p class="text-sm text-muted-foreground">
					Drag the handle down, or flick it, to dismiss.
				</p>
			</DrawerContent>
		</Drawer>
	),
};

const QuickCloseDemo = () => {
	const [open, setOpen] = createSignal(false);
	return (
		<>
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Open quick close
			</Button>
			<Drawer open={open()} onOpenChange={setOpen}>
				<DrawerContent title="Quick close">
					<Button variant="secondary" onClick={() => setOpen(false)}>
						Close now
					</Button>
				</DrawerContent>
			</Drawer>
		</>
	);
};

const closeDuringOpening =
	(delay: number): Story["play"] =>
	async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open quick close" }),
		);
		const dialog = await screen.findByRole("dialog");
		await new Promise((resolve) => setTimeout(resolve, delay));
		within(dialog).getByRole("button", { name: "Close now" }).click();
		await new Promise((resolve) => setTimeout(resolve, 1200));
		await expect(
			document.querySelector("[data-corvu-drawer-content]"),
		).toBeNull();
	};

export const CloseDuringOpening: Story = {
	render: () => <QuickCloseDemo />,
	play: closeDuringOpening(50),
};

export const CloseRightAfterOpening: Story = {
	render: () => <QuickCloseDemo />,
	play: closeDuringOpening(0),
};

export const CloseMidTransition: Story = {
	render: () => <QuickCloseDemo />,
	play: closeDuringOpening(250),
};

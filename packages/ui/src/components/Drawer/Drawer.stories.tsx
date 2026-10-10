import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { DocumentsIcon } from "@solar-icons/solid/bold/documents";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { createSignal, For, type JSX, Show } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	hasIntermediate,
	recordHeightTransitions,
	sampleHeights,
	withSlowMotion,
} from "../../foundations/motion-test";
import { ThreadIcon } from "../../icons/custom";
import { Button } from "../Button/Button";
import { MarkReadIcon } from "../ContextMenu/menu-entries";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { DestructiveRow } from "../List/List";
import { Drawer, DrawerContent, DrawerTrigger } from "./Drawer";

const meta = {
	title: "Overlays/Drawer",
	component: Drawer,
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

type DrawerAction = { icon: JSX.Element; label: string };

const actions: DrawerAction[] = [
	{ icon: <MarkReadIcon />, label: "Mark as read" },
	{ icon: <BellOffIcon />, label: "Mute channel" },
	{ icon: <ThreadIcon />, label: "Start a thread" },
	{ icon: <ChatRoundDotsIcon />, label: "Show all threads" },
	{ icon: <LinkIcon />, label: "Copy channel link" },
];

const manageActions: DrawerAction[] = [
	{ icon: <DocumentsIcon />, label: "Duplicate" },
	{ icon: <SettingsIcon />, label: "Edit channel" },
];

const CHANNEL_AT_URI =
	"at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/social.colibri.beta.channel/3lawesome";

const ActionGroup = (props: { actions: DrawerAction[] }) => (
	<div class="flex flex-col overflow-hidden rounded-control-lg bg-secondary">
		<For each={props.actions}>
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
				<ActionGroup actions={actions} />
				<ActionGroup actions={manageActions} />
				<DestructiveRow icon={<TrashBinTrashIcon />} label="Delete channel" />
				<DeveloperModeCard
					copyLabel="Copy AT-URI"
					copyValue={CHANNEL_AT_URI}
					pdslsHref={`https://pdsls.dev/${CHANNEL_AT_URI}`}
				/>
			</DrawerContent>
		</Drawer>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open channel menu" }),
		);
		const dialog = await screen.findByRole("dialog");
		await expect(within(dialog).getByText("Awesome Channel")).toBeVisible();
		await expect(
			within(dialog)
				.getAllByRole("button")
				.map((button) => button.textContent?.trim())
				.slice(0, 8),
		).toEqual([
			"Mark as read",
			"Mute channel",
			"Start a thread",
			"Show all threads",
			"Copy channel link",
			"Duplicate",
			"Edit channel",
			"Delete channel",
		]);
		await expect(
			within(dialog).getByRole("button", { name: "Copy AT-URI" }),
		).toBeVisible();
		await expect(
			within(dialog).getByRole("link", { name: "Show on PDSls" }),
		).toHaveAttribute("href", `https://pdsls.dev/${CHANNEL_AT_URI}`);
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
		await waitFor(
			() =>
				expect(
					document.querySelector("[data-corvu-drawer-content]"),
				).toBeNull(),
			{ timeout: 4000 },
		);
	};

export const CloseDuringOpening: Story = {
	render: () => <QuickCloseDemo />,
	play: closeDuringOpening(50),
};

export const ClosesWithoutTransitionEnd: Story = {
	render: () => <QuickCloseDemo />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open quick close" }),
		);
		const dialog = await screen.findByRole("dialog");
		await new Promise((resolve) => setTimeout(resolve, 900));
		dialog.style.transitionProperty = "none";
		within(dialog).getByRole("button", { name: "Close now" }).click();
		await waitFor(
			() =>
				expect(
					document.querySelector("[data-corvu-drawer-content]"),
				).toBeNull(),
			{ timeout: 4000 },
		);
	},
};

export const CloseRightAfterOpening: Story = {
	render: () => <QuickCloseDemo />,
	play: closeDuringOpening(0),
};

export const CloseMidTransition: Story = {
	render: () => <QuickCloseDemo />,
	play: closeDuringOpening(250),
};

const GrowingSheet = () => {
	const [expanded, setExpanded] = createSignal(false);
	return (
		<Drawer>
			<DrawerTrigger as={Button} variant="secondary">
				Open growing sheet
			</DrawerTrigger>
			<DrawerContent title="Notifications">
				<Button
					variant="secondary"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded() ? "Show less" : "Show more"}
				</Button>
				<Show when={expanded()}>
					<For each={[1, 2, 3, 4]}>
						{(index) => (
							<div class="flex h-12 shrink-0 items-center rounded-control-lg bg-secondary px-3 text-sm font-semibold">
								Option {index}
							</div>
						)}
					</For>
				</Show>
			</DrawerContent>
		</Drawer>
	);
};

export const AnimatesHeight: Story = {
	render: () => <GrowingSheet />,
	play: async ({ canvasElement }) => {
		const opening = recordHeightTransitions();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open growing sheet" }),
		);
		const dialog = await screen.findByRole("dialog");
		await new Promise((resolve) => setTimeout(resolve, 700));
		opening.stop();
		await expect(opening.count()).toBe(0);
		await waitFor(
			() => expect(dialog).not.toHaveAttribute("data-transitioning"),
			{ timeout: 3000 },
		);
		const before = dialog.offsetHeight;
		await withSlowMotion(async () => {
			const sampling = sampleHeights(dialog, 700);
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Show more" }),
			);
			const samples = await sampling;
			await waitFor(() => expect(dialog.style.height).toBe(""), {
				timeout: 4000,
			});
			const after = dialog.offsetHeight;
			await expect(after).toBeGreaterThan(before + 150);
			await expect(hasIntermediate(samples, before, after)).toBe(true);
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Show less" }),
		);
		await waitFor(
			() => {
				expect(dialog.style.height).toBe("");
				expect(dialog.offsetHeight).toBe(before);
			},
			{ timeout: 3000 },
		);
	},
};

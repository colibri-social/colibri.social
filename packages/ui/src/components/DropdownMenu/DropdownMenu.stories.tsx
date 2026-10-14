import { ArchiveIcon } from "@solar-icons/solid/bold/archive";
import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ShareIcon } from "@solar-icons/solid/bold/share";
import { SortIcon } from "@solar-icons/solid/bold/sort";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../IconButton/IconButton";
import {
	DropdownMenu,
	type DropdownMenuEntry,
	type DropdownMenuPlatform,
} from "./DropdownMenu";

const meta = {
	title: "Overlays/Dropdown menu",
} satisfies Meta;

export default meta;
type Story = StoryObj;

const onRename = fn();
const onDelete = fn();

const Demo = (props: { platform: DropdownMenuPlatform }) => {
	const [compact, setCompact] = createSignal(false);
	const [showPreviews, setShowPreviews] = createSignal(true);
	const [sort, setSort] = createSignal("recent");
	const items = (): DropdownMenuEntry[] => [
		{ label: "Rename", icon: <PenIcon />, hint: "F2", onSelect: onRename },
		{ label: "Copy link", icon: <CopyIcon />, onSelect: fn() },
		{
			kind: "submenu",
			label: "Share to",
			icon: <ShareIcon />,
			items: [
				{ label: "Bluesky", onSelect: fn() },
				{ label: "Copy invite", onSelect: fn() },
			],
		},
		{ kind: "separator" },
		{ kind: "label", label: "Display" },
		{
			kind: "checkbox",
			label: "Compact mode",
			checked: compact(),
			onChange: setCompact,
		},
		{
			kind: "checkbox",
			label: "Link previews",
			checked: showPreviews(),
			onChange: setShowPreviews,
		},
		{
			kind: "radio",
			label: "Sort by",
			value: sort(),
			onChange: setSort,
			options: [
				{ value: "recent", label: "Recent activity" },
				{ value: "name", label: "Name" },
				{
					value: "unread",
					label: "Unread first",
					description: "Channels with mentions stay on top.",
				},
			],
		},
		{ kind: "separator" },
		{ label: "Mute", icon: <BellOffIcon />, onSelect: fn() },
		{ label: "Archive", icon: <ArchiveIcon />, onSelect: fn(), disabled: true },
		{
			label: "Delete channel",
			icon: <TrashBinTrashIcon />,
			tone: "destructive",
			onSelect: onDelete,
		},
	];
	return (
		<div class="flex min-h-[560px] justify-end bg-background p-8">
			<DropdownMenu
				platform={props.platform}
				label="Channel options"
				title="Channel options"
				items={items()}
				triggerAs={IconButton}
				triggerProps={{
					variant: "secondary",
					label: "Channel options",
					icon: <MenuDotsIcon />,
				}}
			/>
			<span data-testid="sort" class="sr-only">
				{sort()}
			</span>
			<span data-testid="compact" class="sr-only">
				{String(compact())}
			</span>
		</div>
	);
};

export const Desktop: Story = {
	render: () => <Demo platform="desktop" />,
	play: async ({ canvasElement }) => {
		onRename.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Channel options" }),
		);
		const menu = await screen.findByRole("menu");
		await expect(
			within(menu).getByRole("menuitem", { name: "Archive" }),
		).toHaveAttribute("aria-disabled", "true");
		await userEvent.click(
			within(menu).getByRole("menuitemcheckbox", { name: "Compact mode" }),
		);
		await expect(canvas.getByTestId("compact")).toHaveTextContent("true");
		await expect(screen.getByRole("menu")).toBeInTheDocument();
		await userEvent.click(
			within(menu).getByRole("menuitemradio", { name: /Name/ }),
		);
		await expect(canvas.getByTestId("sort")).toHaveTextContent("name");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await userEvent.click(
			canvas.getByRole("button", { name: "Channel options" }),
		);
		const reopened = await screen.findByRole("menu");
		const rename = within(reopened).getByRole("menuitem", { name: "Rename" });
		await expect(rename.querySelector("[data-menu-hint]")).toHaveTextContent(
			"F2",
		);
		await userEvent.click(rename);
		await expect(onRename).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

export const DesktopSubmenu: Story = {
	render: () => <Demo platform="desktop" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Channel options" }),
		);
		const menu = await screen.findByRole("menu");
		const share = within(menu).getByRole("menuitem", { name: "Share to" });
		share.focus();
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(screen.getAllByRole("menu")).toHaveLength(2));
		await userEvent.keyboard("{Escape}");
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

export const Mobile: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <Demo platform="mobile" />,
	play: async ({ canvasElement }) => {
		onDelete.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Channel options" }),
		);
		const drawer = await screen.findByRole("dialog");
		await expect(within(drawer).getByText("Share to")).toBeInTheDocument();
		await expect(within(drawer).getByText("Bluesky")).toBeInTheDocument();
		await userEvent.click(within(drawer).getByRole("radio", { name: /Name/ }));
		await expect(canvas.getByTestId("sort")).toHaveTextContent("name");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await userEvent.click(
			canvas.getByRole("button", { name: "Channel options" }),
		);
		const reopened = await screen.findByRole("dialog");
		await userEvent.click(
			within(reopened).getByRole("button", { name: "Delete channel" }),
		);
		await expect(onDelete).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	},
};

export const Sorting: Story = {
	render: () => {
		const [sort, setSort] = createSignal("newest");
		return (
			<div class="flex min-h-[320px] justify-start bg-background p-8">
				<DropdownMenu
					label="Sort"
					placement="bottom-start"
					triggerClass="flex h-9 cursor-pointer items-center gap-2 rounded-control-sm border border-border bg-secondary px-3 text-sm font-semibold text-foreground hover:bg-secondary-highlight"
					trigger={
						<>
							<SortIcon class="size-4" aria-hidden="true" />
							Sort
						</>
					}
					items={[
						{
							kind: "radio",
							value: sort(),
							onChange: setSort,
							options: [
								{ value: "newest", label: "Newest first" },
								{ value: "oldest", label: "Oldest first" },
							],
						},
					]}
				/>
			</div>
		);
	},
};

const flyoutOptions = {
	online: "Online",
	idle: "Away",
	dnd: "Do not disturb",
	offline: "Offline",
} as const;

type FlyoutValue = keyof typeof flyoutOptions;

const FlyoutDot = (props: { value: FlyoutValue }) => (
	<span
		class="size-2.5 rounded-full"
		classList={{
			"bg-green-500": props.value === "online",
			"bg-amber-400": props.value === "idle",
			"bg-red-500": props.value === "dnd",
			"bg-zinc-500": props.value === "offline",
		}}
	/>
);

const SideFlyoutDemo = () => {
	const [value, setValue] = createSignal<FlyoutValue>("online");
	const change = (next: string) => setValue(next as FlyoutValue);
	const items = (): DropdownMenuEntry[] => [
		{
			kind: "radio",
			value: value(),
			onChange: change,
			options: [
				{
					value: "online",
					label: "Online",
					icon: <FlyoutDot value="online" />,
				},
			],
		},
		{ kind: "separator" },
		{
			kind: "radio",
			value: value(),
			onChange: change,
			options: [
				{ value: "idle", label: "Away", icon: <FlyoutDot value="idle" /> },
				{
					value: "dnd",
					label: "Do not disturb",
					description: "You won't get desktop notifications",
					icon: <FlyoutDot value="dnd" />,
				},
				{
					value: "offline",
					label: "Offline",
					description: "You'll appear offline",
					icon: <FlyoutDot value="offline" />,
				},
			],
		},
	];
	return (
		<div class="flex w-72 flex-col gap-1 rounded-control border border-border bg-secondary p-1">
			<DropdownMenu
				submenu
				placement="right-start"
				label="Online status"
				items={items()}
				triggerAs="button"
				triggerProps={{
					type: "button",
					"aria-label": `Online status: ${flyoutOptions[value()]}`,
					"data-flyout-trigger": "",
				}}
				triggerClass="flex h-8 w-full cursor-pointer items-center gap-2 rounded-control-sm border-0 bg-transparent px-2 text-left text-sm font-semibold text-foreground outline-none hover:bg-secondary-highlight focus-ring data-expanded:bg-secondary-highlight"
				trigger={
					<>
						<FlyoutDot value={value()} />
						<span class="min-w-0 flex-1 truncate">
							{flyoutOptions[value()]}
						</span>
						<AltArrowRightIcon aria-hidden="true" class="size-4 shrink-0" />
					</>
				}
			/>
			<button
				type="button"
				class="flex h-8 items-center rounded-control-sm border-0 bg-transparent px-2 text-sm font-semibold text-foreground"
			>
				Edit profile
			</button>
		</div>
	);
};

export const SideFlyout: Story = {
	name: "Side flyout",
	render: () => <SideFlyoutDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /^Online status/ });
		await userEvent.hover(trigger);
		const menu = await screen.findByRole("menu", { name: /^Online status/ });
		await expect(menu.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			trigger.getBoundingClientRect().right,
		);
		await expect(document.activeElement).not.toBe(
			within(menu).getAllByRole("menuitemradio")[0],
		);
		await expect(within(menu).getAllByRole("separator")).toHaveLength(1);
		const dnd = within(menu).getByRole("menuitemradio", {
			name: /Do not disturb/,
		});
		await expect(dnd).toHaveTextContent("You won't get desktop notifications");
		await userEvent.click(trigger);
		await expect(screen.getByRole("menu")).toBeInTheDocument();
		await userEvent.click(dnd);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await expect(trigger).toHaveAccessibleName("Online status: Do not disturb");
		trigger.focus();
		await userEvent.keyboard("{ArrowRight}");
		const keyed = await screen.findByRole("menu", { name: /^Online status/ });
		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(keyed).getAllByRole("menuitemradio")[0],
			),
		);
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(trigger));
		await userEvent.keyboard("{Enter}");
		await screen.findByRole("menu", { name: /^Online status/ });
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await userEvent.hover(trigger);
		await screen.findByRole("menu", { name: /^Online status/ });
		await userEvent.unhover(trigger);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

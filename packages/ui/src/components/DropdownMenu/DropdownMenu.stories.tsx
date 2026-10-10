import { ArchiveIcon } from "@solar-icons/solid/bold/archive";
import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ShareIcon } from "@solar-icons/solid/bold/share";
import { SortIcon } from "@solar-icons/solid/bold/sort";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
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

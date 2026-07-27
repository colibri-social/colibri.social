import { createSignal } from "solid-js";
import { toast } from "somoto";
import { Button } from "../../../src/components/ui/Button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../../src/components/ui/ContextMenu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../../src/components/ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../src/components/ui/DropdownMenu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardPortal,
	HoverCardTrigger,
} from "../../../src/components/ui/HoverCard";
import {
	MenuDrawer,
	MenuDrawerItem,
} from "../../../src/components/ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "../../../src/components/ui/Popover";
import { ResponsiveDialog } from "../../../src/components/ui/ResponsiveDialog";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../../src/components/ui/Tooltip";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const DialogDemo = () => (
	<Demo label="Dialog">
		<Dialog>
			<DialogTrigger as={Button<"button">} variant="outline">
				Open dialog
			</DialogTrigger>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete channel</DialogTitle>
						<DialogDescription>
							This removes the channel and everything in it.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="destructive">Delete</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	</Demo>
);

const ResponsiveDialogDemo = () => {
	const [open, setOpen] = createSignal(false);

	return (
		<Demo label="ResponsiveDialog">
			<Button variant="outline" onClick={() => setOpen(true)}>
				Open responsive dialog
			</Button>
			<ResponsiveDialog
				open={open()}
				onOpenChange={setOpen}
				title="Responsive dialog"
			>
				<p class="text-sm">
					Renders as a dialog on desktop and as a bottom sheet on mobile widths.
				</p>
			</ResponsiveDialog>
		</Demo>
	);
};

const DropdownMenuDemo = () => (
	<Demo label="DropdownMenu">
		<DropdownMenu>
			<DropdownMenuTrigger as={Button<"button">} variant="outline">
				Open menu
			</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent>
					<DropdownMenuItem>Edit</DropdownMenuItem>
					<DropdownMenuItem>Duplicate</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenu>
	</Demo>
);

const ContextMenuDemo = () => (
	<Demo label="ContextMenu">
		<ContextMenu>
			<ContextMenuTrigger class="border-border text-muted-foreground flex h-24 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm">
				Right-click here
			</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent>
					<ContextMenuItem>Reply</ContextMenuItem>
					<ContextMenuItem>Copy text</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem variant="destructive">
						Delete message
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenu>
	</Demo>
);

const PopoverDemo = () => (
	<Demo label="Popover">
		<Popover>
			<PopoverTrigger as={Button<"button">} variant="outline">
				Open popover
			</PopoverTrigger>
			<PopoverContent class="w-64">
				<p class="text-sm">Anything can live in a popover.</p>
			</PopoverContent>
		</Popover>
	</Demo>
);

const HoverCardDemo = () => (
	<Demo label="HoverCard">
		<HoverCard>
			<HoverCardTrigger class="underline decoration-dotted">
				Hover over me
			</HoverCardTrigger>
			<HoverCardPortal>
				<HoverCardContent class="w-64">
					<p class="text-sm">Shown after a short hover delay.</p>
				</HoverCardContent>
			</HoverCardPortal>
		</HoverCard>
	</Demo>
);

const TooltipDemo = () => (
	<Demo label="Tooltip">
		<Tooltip>
			<TooltipTrigger as={Button<"button">} variant="outline">
				Hover for a tooltip
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent>Tooltips are brief.</TooltipContent>
			</TooltipPortal>
		</Tooltip>
	</Demo>
);

const MenuDrawerDemo = () => {
	const [open, setOpen] = createSignal(false);

	return (
		<Demo label="MenuDrawer">
			<Button variant="outline" onClick={() => setOpen(true)}>
				Open drawer
			</Button>
			<MenuDrawer open={open()} onOpenChange={setOpen}>
				<MenuDrawerItem onClick={() => setOpen(false)}>
					First action
				</MenuDrawerItem>
				<MenuDrawerItem onClick={() => setOpen(false)}>
					Second action
				</MenuDrawerItem>
				<MenuDrawerItem destructive onClick={() => setOpen(false)}>
					Destructive action
				</MenuDrawerItem>
			</MenuDrawer>
		</Demo>
	);
};

const ToastsDemo = () => (
	<Demo label="Toasts">
		<Button variant="outline" onClick={() => toast("Plain toast")}>
			Toast
		</Button>
		<Button variant="outline" onClick={() => toast.success("Message sent")}>
			Success
		</Button>
		<Button
			variant="outline"
			onClick={() => toast.error("Failed to send message")}
		>
			Error
		</Button>
	</Demo>
);

export const OVERLAYS: SandboxCategory = {
	id: "overlays",
	title: "Overlays",
	items: [
		{ id: "dialog", title: "Dialog", component: DialogDemo },
		{
			id: "responsive-dialog",
			title: "ResponsiveDialog",
			component: ResponsiveDialogDemo,
		},
		{
			id: "dropdown-menu",
			title: "DropdownMenu",
			component: DropdownMenuDemo,
		},
		{ id: "context-menu", title: "ContextMenu", component: ContextMenuDemo },
		{ id: "popover", title: "Popover", component: PopoverDemo },
		{ id: "hover-card", title: "HoverCard", component: HoverCardDemo },
		{ id: "tooltip", title: "Tooltip", component: TooltipDemo },
		{ id: "menu-drawer", title: "MenuDrawer", component: MenuDrawerDemo },
		{ id: "toasts", title: "Toasts", component: ToastsDemo },
	],
};

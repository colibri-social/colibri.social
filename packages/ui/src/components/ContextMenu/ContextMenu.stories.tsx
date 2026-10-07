import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ContextMenu, DropdownMenu, MenuItem, MenuSeparator } from "./Menu";
import { MessageContextMenu } from "./MessageMenu";

const meta = {
	title: "Overlays/Context menu",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const rightClick = (element: Element) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 24,
			clientY: rect.top + 16,
		}),
	);
};

const onCopy = fn();
const onDelete = fn();

export const Generic: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<ContextMenu
				menu={
					<>
						<MenuItem label="Copy" onSelect={onCopy} />
						<MenuItem label="Disabled item" disabled />
						<MenuSeparator />
						<MenuItem label="Delete" tone="destructive" onSelect={onDelete} />
					</>
				}
			>
				<div
					data-testid="area"
					class="flex h-40 items-center justify-center rounded-surface border border-dashed border-border text-sm text-muted-foreground"
				>
					Right-click anywhere in this area
				</div>
			</ContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		onCopy.mockClear();
		onDelete.mockClear();
		const area = within(canvasElement).getByTestId("area");
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu")) rightClick(area);
			return screen.getByRole("menu");
		});
		await expect(
			await within(menu).findByRole("menuitem", { name: "Disabled item" }),
		).toHaveAttribute("aria-disabled", "true");
		await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard("{Enter}");
		await expect(onCopy).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

const onDropdownSelect = fn();

export const Dropdown: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		return (
			<div class="flex min-h-screen justify-end bg-background p-8">
				<DropdownMenu
					triggerLabel="More actions"
					triggerContent={<span class="px-3 text-sm font-semibold">More</span>}
					triggerClass="flex h-9 items-center rounded-control border border-border bg-secondary text-foreground hover:bg-secondary-highlight"
					open={open()}
					onOpenChange={setOpen}
					menu={
						<>
							<MenuItem label="Rename" onSelect={onDropdownSelect} />
							<MenuItem label="Archive" onSelect={onDropdownSelect} />
						</>
					}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		onDropdownSelect.mockClear();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "More actions" }),
		);
		const menu = await screen.findByRole("menu");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Archive" }),
		);
		await expect(onDropdownSelect).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

const onOpenLink = fn();

export const MessageMenu: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<MessageContextMenu
				link={{ onOpen: onOpenLink, onCopy: fn() }}
				onEdit={fn()}
				onReply={fn()}
				onForward={fn()}
				onOpenThread={fn()}
				onSelect={fn()}
				onCopyText={fn()}
				gif={{ saved: true, onToggle: fn() }}
				onLinkPreviews={fn()}
				onViewReactions={fn()}
				onDebugInfo={fn()}
				onDelete={fn()}
			>
				<div
					data-testid="message"
					class="rounded-control px-4 py-3 text-base hover:bg-card"
				>
					Right-click this message. It has a link, a saved GIF and every action.
				</div>
			</MessageContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		onOpenLink.mockClear();
		const message = within(canvasElement).getByTestId("message");
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu")) rightClick(message);
			return screen.getByRole("menu");
		});
		await within(menu).findByRole("menuitem", { name: "Delete message" });
		const labels = within(menu)
			.getAllByRole("menuitem")
			.map((item) => item.textContent?.trim());
		await expect(labels).toEqual([
			"Open link",
			"Copy link",
			"Edit message",
			"Reply",
			"Forward",
			"Open thread",
			"Select messages",
			"Copy text",
			"Remove saved GIF",
			"Link previews",
			"View reactions",
			"Show debug information",
			"Delete message",
		]);
		await expect(
			within(menu).getByRole("menuitem", { name: "Delete message" }),
		).toHaveAttribute("data-tone", "destructive");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Open link" }),
		);
		await expect(onOpenLink).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { MessageGestures } from "../MessageActions/MessageGestures";
import { ConfirmDialog } from "../Modal/ConfirmDialog";
import { ThreadCard, ThreadRow } from "./Thread";
import { ThreadDrawer } from "./ThreadDrawer";

const meta = {
	title: "Messaging/Thread drawer",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const spy = {
	follow: fn(),
	mute: fn(),
	markRead: fn(),
	copyLink: fn(),
	rename: fn(),
	move: fn(),
	remove: fn(),
	confirm: fn(),
	rowOpen: fn(),
	rowMenu: fn(),
	messageHold: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

const LONG_NAME =
	"Kingfisher sightings along the river path behind the old mill, spring edition";
const LONG_CHANNEL = "birdwatching-field-notes-and-very-long-channel-names";

const targets = [
	{ id: "design", name: "design" },
	{ id: "dev", name: "dev" },
	{ id: "long", name: LONG_CHANNEL },
];

const afterDrawerClosed = () =>
	new Promise<void>((resolve) => {
		const check = () => {
			if (!document.querySelector('[role="dialog"]')) {
				requestAnimationFrame(() => resolve());
				return;
			}
			setTimeout(check, 50);
		};
		check();
	});

const ThreadDrawerDemo = (props: {
	name?: string;
	manage?: boolean;
	failRename?: boolean;
}) => {
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal(props.name ?? "Crow whispering");
	const [following, setFollowing] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	const [confirming, setConfirming] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold thread
			</Button>
			<ThreadDrawer
				open={open()}
				onOpenChange={setOpen}
				name={name()}
				channelName={LONG_CHANNEL}
				following={following()}
				onFollowingChange={(next) => {
					spy.follow(next);
					setFollowing(next);
				}}
				muted={muted()}
				onMutedChange={(next) => {
					spy.mute(next);
					setMuted(next);
				}}
				onMarkAsRead={spy.markRead}
				onCopyLink={spy.copyLink}
				onRename={
					props.manage
						? async (next) => {
								spy.rename(next);
								await new Promise((resolve) => setTimeout(resolve, 100));
								if (props.failRename) throw new Error("offline");
								setName(next);
							}
						: undefined
				}
				moveTargets={targets}
				onMove={props.manage ? (target) => spy.move(target) : undefined}
				onDelete={
					props.manage
						? () => {
								spy.remove();
								void afterDrawerClosed().then(() => setConfirming(true));
							}
						: undefined
				}
			/>
			<ConfirmDialog
				open={confirming()}
				onOpenChange={setConfirming}
				title={`Delete ${name()}?`}
				description="This permanently deletes the thread. Messages members wrote here stay in their own repos, but nobody except their authors will be able to read them afterward. This cannot be undone."
				confirmLabel="Delete thread"
				tone="destructive"
				onConfirm={() => {
					spy.confirm();
					return new Promise((resolve) => setTimeout(resolve, 150));
				}}
			/>
		</div>
	);
};

const openDrawer = async (canvasElement: HTMLElement, name: string) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Hold thread" }),
	);
	const dialog = await screen.findByRole("dialog", { name: `${name} options` });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	return dialog;
};

const waitForDrawerClosed = (name: string) =>
	waitFor(
		() =>
			expect(
				screen.queryByRole("dialog", { name: `${name} options` }),
			).toBeNull(),
		{ timeout: 3000 },
	);

export const Member: Story = {
	render: () => <ThreadDrawerDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Crow whispering");
		await expectNoLayoutIssues(dialog);
		const header = dialog.querySelector(
			"[data-thread-drawer-header]",
		) as HTMLElement;
		await expect(
			Math.round(
				header.getBoundingClientRect().left -
					dialog.getBoundingClientRect().left,
			),
		).toBe(16);
		for (const label of ["Rename thread", "Move to channel", "Delete thread"]) {
			await expect(
				within(dialog).queryByRole("button", { name: label }),
			).toBeNull();
		}
		await userEvent.click(
			within(dialog).getByRole("switch", { name: /Follow thread/ }),
		);
		await expect(spy.follow).toHaveBeenCalledWith(true);
		await expect(screen.queryByRole("dialog")).not.toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Copy thread link" }),
		);
		await expect(spy.copyLink).toHaveBeenCalledTimes(1);
		await waitForDrawerClosed("Crow whispering");
	},
};

export const Manager: Story = {
	render: () => <ThreadDrawerDemo manage name={LONG_NAME} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, LONG_NAME);
		await expectNoLayoutIssues(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete thread" }),
		);
		await expect(spy.remove).toHaveBeenCalledTimes(1);
		await waitForDrawerClosed(LONG_NAME);
		const confirm = await screen.findByRole("dialog", {
			name: `Delete ${LONG_NAME}?`,
		});
		await waitFor(() => expect(confirm).toBeVisible());
		await expectNoLayoutIssues(confirm);
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Delete thread" }),
		);
		await expect(spy.confirm).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
			timeout: 3000,
		});
	},
};

export const RenameInPlace: Story = {
	render: () => <ThreadDrawerDemo manage />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Crow whispering");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rename thread" }),
		);
		const input = await within(dialog).findByRole("textbox", { name: "Name" });
		await expect(input).toHaveValue("Crow whispering");
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expectNoLayoutIssues(dialog);
		await userEvent.keyboard("{Escape}");
		await expect(
			await within(dialog).findByRole("button", { name: "Rename thread" }),
		).toBeVisible();
		await expect(screen.queryByRole("dialog")).not.toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rename thread" }),
		);
		const field = await within(dialog).findByRole("textbox", { name: "Name" });
		await waitFor(() => expect(field).toHaveValue("Crow whispering"));
		await new Promise((resolve) => setTimeout(resolve, 300));
		await userEvent.clear(field);
		await expect(field).toHaveValue("");
		await expect(
			within(dialog).getByRole("button", { name: "Rename" }),
		).toBeDisabled();
		await userEvent.type(field, "Crow council");
		await expect(field).toHaveValue("Crow council");
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(spy.rename).toHaveBeenCalledWith("Crow council"),
		);
		await waitForDrawerClosed("Crow council");
		await afterDrawerClosed();
		await new Promise((resolve) => setTimeout(resolve, 300));
		await openDrawer(canvasElement, "Crow council");
		await expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
	},
};

export const RenameFailure: Story = {
	render: () => <ThreadDrawerDemo manage failRename />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Crow whispering");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rename thread" }),
		);
		const field = await within(dialog).findByRole("textbox", { name: "Name" });
		await userEvent.type(field, " again");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rename" }),
		);
		await expect(
			await within(dialog).findByText("Couldn't rename the thread. Try again."),
		).toBeVisible();
		await expect(screen.queryByRole("dialog")).not.toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await expectNoLayoutIssues(dialog);
	},
};

export const MoveToChannel: Story = {
	render: () => <ThreadDrawerDemo manage />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Crow whispering");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Move to channel" }),
		);
		const group = await within(dialog).findByRole("radiogroup", {
			name: "Destination channel",
		});
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expectNoLayoutIssues(dialog);
		await userEvent.click(within(group).getByText("#dev"));
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Move thread" }),
		);
		await expect(spy.move).toHaveBeenCalledWith("dev");
		await waitForDrawerClosed("Crow whispering");
	},
};

export const MoveGuardsUnsavedChoice: Story = {
	render: () => <ThreadDrawerDemo manage />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Crow whispering");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Move to channel" }),
		);
		const group = await within(dialog).findByRole("radiogroup", {
			name: "Destination channel",
		});
		await new Promise((resolve) => setTimeout(resolve, 300));
		await userEvent.click(within(group).getByText("#dev"));
		await userEvent.click(
			document.querySelector("[data-corvu-drawer-overlay]") as HTMLElement,
		);
		const prompt = await screen.findByRole(
			"dialog",
			{ name: "Discard changes?" },
			{ timeout: 3000 },
		);
		await expect(prompt).toHaveTextContent("The thread stays where it is.");
		await expectNoLayoutIssues(prompt);
		await userEvent.click(
			within(prompt).getByRole("button", { name: "Discard changes" }),
		);
		await waitForDrawerClosed("Crow whispering");
		await expect(spy.move).not.toHaveBeenCalled();
	},
};

let pointerSeed = 0;

export const RowHoldOpensMenu: Story = {
	render: () => (
		<div class="min-h-dvh bg-popover p-4">
			<ThreadRow
				name={LONG_NAME}
				messageCount={12}
				age="5m"
				unread
				onOpen={spy.rowOpen}
				onMenu={spy.rowMenu}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		await expectNoLayoutIssues(canvasElement);
		const row = within(canvasElement).getByRole("button", {
			name: new RegExp(`^${LONG_NAME.slice(0, 20)}`),
		});
		const box = row.getBoundingClientRect();
		const init = {
			bubbles: true,
			pointerType: "touch",
			pointerId: ++pointerSeed,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 2,
		};
		row.dispatchEvent(new PointerEvent("pointerdown", init));
		await new Promise((resolve) => setTimeout(resolve, 500));
		row.dispatchEvent(new PointerEvent("pointerup", init));
		row.click();
		await expect(spy.rowMenu).toHaveBeenCalledTimes(1);
		await expect(spy.rowOpen).not.toHaveBeenCalled();
		row.dispatchEvent(
			new PointerEvent("pointerdown", {
				...init,
				pointerType: "mouse",
				pointerId: ++pointerSeed,
				button: 2,
			}),
		);
		row.dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
		);
		await expect(spy.rowMenu).toHaveBeenCalledTimes(2);
		await userEvent.click(row);
		await expect(spy.rowOpen).toHaveBeenCalledTimes(1);
	},
};

export const MessageThreadCardHold: Story = {
	render: () => (
		<div class="min-h-dvh bg-background p-4">
			<MessageGestures longPress onLongPress={spy.messageHold}>
				<div class="flex flex-col gap-2">
					<p class="text-base">Who else saw the kingfisher this morning?</p>
					<ThreadCard
						name={LONG_NAME}
						messageCount={4}
						age="2m"
						unread
						onOpen={spy.rowOpen}
						onMenu={spy.rowMenu}
					/>
				</div>
			</MessageGestures>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		await expectNoLayoutIssues(canvasElement);
		const card = canvasElement.querySelector<HTMLElement>("[data-thread]");
		if (!card) throw new Error("Thread card missing");
		const box = card.getBoundingClientRect();
		const init = {
			bubbles: true,
			pointerType: "touch",
			pointerId: ++pointerSeed,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 2,
		};
		card.dispatchEvent(new PointerEvent("pointerdown", init));
		await new Promise((resolve) => setTimeout(resolve, 500));
		card.dispatchEvent(new PointerEvent("pointerup", init));
		card.click();
		await expect(spy.rowMenu).toHaveBeenCalledTimes(1);
		await expect(spy.messageHold).not.toHaveBeenCalled();
		await expect(spy.rowOpen).not.toHaveBeenCalled();
		const text = within(canvasElement).getByText(/kingfisher this morning/);
		const textBox = text.getBoundingClientRect();
		const textInit = {
			bubbles: true,
			pointerType: "touch",
			pointerId: ++pointerSeed,
			clientX: textBox.left + 4,
			clientY: textBox.top + textBox.height / 2,
		};
		text.dispatchEvent(new PointerEvent("pointerdown", textInit));
		await new Promise((resolve) => setTimeout(resolve, 500));
		text.dispatchEvent(new PointerEvent("pointerup", textInit));
		await expect(spy.messageHold).toHaveBeenCalledTimes(1);
		await userEvent.click(card);
		await expect(spy.rowOpen).toHaveBeenCalledTimes(1);
	},
};

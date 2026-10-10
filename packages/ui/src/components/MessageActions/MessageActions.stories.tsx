import { createRoot, createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { createSwipe } from "../../utils/gestures/swipe";
import { type Haptics, HapticsProvider } from "../../utils/haptics";
import {
	MessageContextMenu,
	MessageMenuItems,
} from "../ContextMenu/MessageMenu";
import { MessageActionsDrawer } from "./MessageActionsDrawer";
import { MessageGestures } from "./MessageGestures";
import { MessageToolbar } from "./MessageToolbar";
import { type Reaction, ReactionBar } from "./ReactionBar";
import { SwipeToReply } from "./SwipeToReply";

const meta = {
	title: "Messaging/Message actions",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const haptics = {
	impact: fn(),
	selection: fn(),
	notification: fn(),
} satisfies Haptics;

const StandInRow = (props: { text: string }) => (
	<div class="flex gap-3 px-4 py-2">
		<div class="size-10 shrink-0 rounded-full bg-muted" />
		<div class="flex min-w-0 flex-col">
			<span class="text-sm font-semibold">Lou</span>
			<span class="text-base">{props.text}</span>
		</div>
	</div>
);

const touch = (
	type: string,
	target: Element,
	x: number,
	y = 20,
	extra: PointerEventInit = {},
) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType: "touch",
			pointerId: 1,
			isPrimary: true,
			clientX: x,
			clientY: y,
			...extra,
		}),
	);

const onToggle = fn();
const onAdd = fn();
const onShowReactors = fn();

export const Reactions: Story = {
	render: () => {
		const [reactions, setReactions] = createSignal<Reaction[]>([
			{ emoji: "🐦", count: 3, reactors: ["Lou", "Ana", "Ben"] },
			{ emoji: "👀", count: 1, mine: true, reactors: ["You"] },
			{ emoji: "🔥", count: 12, reactors: ["Ana", "Ben", "Cam"] },
		]);
		const toggle = (emoji: string, mine: boolean) => {
			onToggle(emoji, mine);
			setReactions((list) =>
				list.map((item) =>
					item.emoji === emoji
						? { ...item, mine: !mine, count: item.count + (mine ? -1 : 1) }
						: item,
				),
			);
		};
		return (
			<div class="min-h-screen bg-background p-4">
				<ReactionBar
					reactions={reactions()}
					onToggle={toggle}
					onAdd={onAdd}
					onShowReactors={onShowReactors}
				/>
			</div>
		);
	},
	parameters: iphone,
	play: async ({ canvasElement }) => {
		onToggle.mockClear();
		onAdd.mockClear();
		const canvas = within(canvasElement);
		const bird = canvas.getByRole("button", { name: "🐦 3" });
		await expect(bird).toHaveAttribute("aria-pressed", "false");
		const others = ["👀", "🔥"].map(
			(emoji) =>
				canvasElement.querySelector(
					`[data-reaction="${emoji}"]`,
				) as HTMLElement,
		);
		const othersBefore = others.map((chip) => chip.firstElementChild);
		await userEvent.click(bird);
		await expect(onToggle).toHaveBeenCalledWith("🐦", false);
		await expect(bird.getAnimations({ subtree: true }).length).toBeGreaterThan(
			0,
		);
		for (const [index, chip] of others.entries()) {
			await expect(chip.getAnimations({ subtree: true }).length).toBe(0);
			await expect(chip.isConnected).toBe(true);
			await expect(chip.firstElementChild).toBe(othersBefore[index]);
		}
		const toggled = await canvas.findByRole("button", { name: "🐦 4" });
		await expect(toggled).toHaveAttribute("aria-pressed", "true");
		await expect(toggled).toHaveAttribute("data-mine");
		await userEvent.click(toggled);
		await expect(onToggle).toHaveBeenLastCalledWith("🐦", true);
		await expect(
			await canvas.findByRole("button", { name: "🐦 3" }),
		).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(canvas.getByRole("button", { name: "Add reaction" }));
		await expect(onAdd).toHaveBeenCalledTimes(1);
		onShowReactors.mockClear();
		const fire = canvas.getByRole("button", { name: "🔥 12" });
		const rect = fire.getBoundingClientRect();
		touch("pointerdown", fire, rect.left + 8, rect.top + 8);
		await expect(fire.querySelector("[data-ripple-wave]")).not.toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 500));
		touch("pointerup", fire, rect.left + 8, rect.top + 8);
		await expect(onShowReactors).toHaveBeenCalledWith("🔥");
	},
};

const toolbarReply = fn();
const toolbarEdit = fn();
const toolbarForward = fn();
const toolbarAddReaction = fn();
const menuDelete = fn();
const menuReply = fn();
const toolbarThread = fn();
const toolbarCopy = fn();
const toolbarDelete = fn();
const toolbarSelect = fn();
const toolbarHide = fn();

const StandInMessage = (props: { own: boolean; text: string }) => {
	const [menuOpen, setMenuOpen] = createSignal(false);
	const [pickerOpen, setPickerOpen] = createSignal(false);
	const menu = () => (
		<MessageMenuItems
			onEdit={props.own ? fn() : undefined}
			onReply={menuReply}
			onForward={fn()}
			onOpenThread={fn()}
			onSelect={fn()}
			onCopyText={fn()}
			onViewReactions={fn()}
			onDebugInfo={fn()}
			onDelete={props.own ? menuDelete : undefined}
			onHide={props.own ? undefined : fn()}
		/>
	);
	return (
		<MessageContextMenu
			onEdit={props.own ? fn() : undefined}
			onReply={menuReply}
			onForward={fn()}
			onOpenThread={fn()}
			onSelect={fn()}
			onCopyText={fn()}
			onViewReactions={fn()}
			onDebugInfo={fn()}
			onDelete={props.own ? menuDelete : undefined}
			onHide={props.own ? undefined : fn()}
		>
			<div
				data-testid={props.own ? "own-message" : "other-message"}
				class="group relative rounded-control px-4 py-6 hover:bg-card"
			>
				<StandInRow text={props.text} />
				<div
					class={
						menuOpen() || pickerOpen()
							? "absolute top-0 right-4 -translate-y-1/2"
							: "absolute top-0 right-4 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
					}
				>
					<MessageToolbar
						own={props.own}
						recentReactions={["🐦", "👀", "🔥"]}
						onReact={fn()}
						onAddReaction={() => {
							toolbarAddReaction();
							setPickerOpen((open) => !open);
						}}
						onEdit={toolbarEdit}
						onReply={toolbarReply}
						onForward={toolbarForward}
						onOpenThread={toolbarThread}
						onCopyText={toolbarCopy}
						onDelete={props.own ? toolbarDelete : undefined}
						onSelect={props.own ? undefined : toolbarSelect}
						onHide={props.own ? undefined : toolbarHide}
						menu={menu()}
						menuOpen={menuOpen()}
						onMenuOpenChange={setMenuOpen}
					/>
					<Show when={pickerOpen()}>
						<div
							role="dialog"
							aria-label="Emoji picker"
							class="absolute top-full right-0 mt-1.5 grid w-56 grid-cols-6 gap-1 rounded-control-lg border border-border bg-popover p-2 shadow-overlay"
						>
							<For
								each={[
									"😀",
									"😂",
									"😍",
									"🥲",
									"🤔",
									"😴",
									"👍",
									"🙏",
									"🎉",
									"🔥",
									"🐦",
									"👀",
								]}
							>
								{(emoji) => (
									<button
										type="button"
										aria-label={`React with ${emoji}`}
										onClick={() => setPickerOpen(false)}
										class="flex size-8 items-center justify-center rounded-control-sm text-lg hover:bg-popover-highlight"
									>
										{emoji}
									</button>
								)}
							</For>
						</div>
					</Show>
				</div>
			</div>
		</MessageContextMenu>
	);
};

export const Toolbar: Story = {
	render: () => (
		<div class="flex min-h-screen flex-col gap-10 bg-background p-8 pt-16">
			<StandInMessage own text="Your message: react, edit, forward, more." />
			<StandInMessage
				own={false}
				text="Someone else's message: react, reply, forward, more."
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		toolbarReply.mockClear();
		toolbarEdit.mockClear();
		menuDelete.mockClear();
		const canvas = within(canvasElement);
		const [ownBar, otherBar] = canvas
			.getAllByRole("toolbar", { name: "Message actions" })
			.map((element) => within(element));
		const names = (bar: typeof ownBar) =>
			bar
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label"));
		await expect(names(ownBar)).toEqual([
			"React with 🐦",
			"React with 👀",
			"React with 🔥",
			"Add reaction",
			"Edit",
			"Forward",
			"More actions",
		]);
		await expect(names(otherBar)).toEqual([
			"React with 🐦",
			"React with 👀",
			"React with 🔥",
			"Add reaction",
			"Reply",
			"Forward",
			"More actions",
		]);
		const separators = canvasElement.querySelectorAll(
			"[data-toolbar-separator]",
		);
		await expect(separators.length).toBe(2);
		const toolbarElement = canvasElement.querySelector(
			"[data-message-toolbar]",
		) as HTMLElement;
		const toolbarStyle = getComputedStyle(toolbarElement);
		await expect(toolbarStyle.paddingTop).toBe("2px");
		await expect(toolbarStyle.borderTopLeftRadius).toBe("10px");
		await expect(
			getComputedStyle(
				toolbarElement.querySelector("[data-toolbar-action]") as HTMLElement,
			).borderTopLeftRadius,
		).toBe("8px");
		await expect(
			canvasElement.querySelectorAll(
				"[data-message-toolbar] [data-animated-icon], [data-message-toolbar] .icon-fx",
			).length,
		).toBe(0);
		await userEvent.click(otherBar.getByRole("button", { name: "Reply" }));
		await expect(toolbarReply).toHaveBeenCalledTimes(1);
		await userEvent.click(ownBar.getByRole("button", { name: "Edit" }));
		await expect(toolbarEdit).toHaveBeenCalledTimes(1);

		await userEvent.click(ownBar.getByRole("button", { name: "More actions" }));
		const menu = await screen.findByRole("menu");
		await expect(
			await within(menu).findByRole("menuitem", { name: "Delete message" }),
		).toBeVisible();
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Delete message" }),
		);
		await expect(menuDelete).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

export const ToolbarShiftReveal: Story = {
	render: () => (
		<div class="flex min-h-screen flex-col gap-10 bg-background p-8 pt-16">
			<StandInMessage own text="Hold Shift for reply, thread, copy, delete." />
			<StandInMessage
				own={false}
				text="Hold Shift for thread, copy, select, hide."
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		toolbarThread.mockClear();
		toolbarDelete.mockClear();
		toolbarHide.mockClear();
		const canvas = within(canvasElement);
		const [ownBar, otherBar] = canvas
			.getAllByRole("toolbar", { name: "Message actions" })
			.map((element) => within(element));
		const names = (bar: typeof ownBar) =>
			bar
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label"));
		const extras = canvasElement.querySelectorAll<HTMLElement>(
			"[data-toolbar-extras]",
		);
		await expect(extras.length).toBe(2);
		for (const extra of extras) {
			await expect(extra).toHaveAttribute("inert");
			await expect(extra.getBoundingClientRect().width).toBe(0);
		}
		await expect(names(ownBar)).not.toContain("Delete message");

		window.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }),
		);
		await waitFor(() =>
			expect(names(ownBar)).toEqual([
				"React with 🐦",
				"React with 👀",
				"React with 🔥",
				"Add reaction",
				"Edit",
				"Forward",
				"Reply",
				"Open thread",
				"Copy text",
				"Delete message",
				"More actions",
			]),
		);
		await expect(names(otherBar)).toEqual([
			"React with 🐦",
			"React with 👀",
			"React with 🔥",
			"Add reaction",
			"Reply",
			"Forward",
			"Open thread",
			"Copy text",
			"Select messages",
			"Hide message",
			"More actions",
		]);
		for (const extra of extras) {
			await expect(extra).not.toHaveAttribute("inert");
			await waitFor(() =>
				expect(extra.getBoundingClientRect().width).toBeGreaterThan(100),
			);
		}
		const deleteButton = ownBar.getByRole("button", { name: "Delete message" });
		await expect(deleteButton.className).toContain("text-destructive");
		await userEvent.click(deleteButton);
		await expect(toolbarDelete).toHaveBeenCalledTimes(1);
		await userEvent.click(
			otherBar.getByRole("button", { name: "Open thread" }),
		);
		await expect(toolbarThread).toHaveBeenCalledTimes(1);
		await userEvent.click(
			otherBar.getByRole("button", { name: "Hide message" }),
		);
		await expect(toolbarHide).toHaveBeenCalledTimes(1);

		window.dispatchEvent(
			new KeyboardEvent("keyup", { key: "Shift", shiftKey: false }),
		);
		await waitFor(() => expect(names(ownBar)).not.toContain("Delete message"));
		for (const extra of extras) {
			await expect(extra).toHaveAttribute("inert");
			await waitFor(() => expect(extra.getBoundingClientRect().width).toBe(0));
		}
	},
};

export const RightClickMenu: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-8 pt-16">
			<StandInMessage
				own={false}
				text="Right-click this message for the full menu."
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		menuReply.mockClear();
		const row = within(canvasElement).getByTestId("other-message");
		const rect = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				button: 2,
				clientX: rect.left + 40,
				clientY: rect.top + 20,
			}),
		);
		const menu = await screen.findByRole("menu");
		await within(menu).findByRole("menuitem", { name: "Hide message" });
		const items = within(menu)
			.getAllByRole("menuitem")
			.map((item) => item.textContent?.trim());
		await expect(items).toEqual([
			"Reply",
			"Forward",
			"Open thread",
			"Select messages",
			"Copy text",
			"View reactions",
			"Show debug information",
			"Hide message",
		]);
		await userEvent.keyboard("{ArrowDown}");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Reply" }),
		);
		await expect(menuReply).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

const swipeReply = fn();

const nextFrame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const SwipeReply: Story = {
	render: () => (
		<HapticsProvider haptics={haptics}>
			<div class="min-h-screen bg-background py-4">
				<SwipeToReply onReply={swipeReply}>
					<StandInRow text="Swipe this message to the left to reply." />
				</SwipeToReply>
			</div>
		</HapticsProvider>
	),
	parameters: iphone,
	play: async ({ canvasElement }) => {
		swipeReply.mockClear();
		haptics.impact.mockClear();
		const content = canvasElement.querySelector(
			"[data-swipe-content]",
		) as HTMLElement;
		const rect = content.getBoundingClientRect();
		const y = rect.top + rect.height / 2;
		const startX = rect.left + 300;

		touch("pointerdown", content, startX, y);
		touch("pointermove", content, startX - 12, y);
		touch("pointermove", content, startX - 20, y);
		await nextFrame();
		await nextFrame();
		touch("pointerup", content, startX - 20, y);
		await nextFrame();
		await expect(swipeReply).not.toHaveBeenCalled();
		await expect(haptics.impact).not.toHaveBeenCalled();

		touch("pointerdown", content, startX, y);
		touch("pointermove", content, startX - 12, y);
		await nextFrame();
		touch("pointermove", content, startX - 40, y);
		await nextFrame();
		touch("pointermove", content, startX - 70, y);
		await nextFrame();
		await waitFor(() => expect(haptics.impact).toHaveBeenCalledTimes(1));
		await expect(
			canvasElement.querySelector("[data-swipe-arrow]"),
		).toHaveAttribute("data-crossed");
		touch("pointermove", content, startX - 80, y);
		await nextFrame();
		await expect(haptics.impact).toHaveBeenCalledTimes(1);
		touch("pointerup", content, startX - 80, y);
		await expect(swipeReply).toHaveBeenCalledTimes(1);
		for (let frame = 0; frame < 60; frame++) {
			await nextFrame();
			const match = /translateX\((-?[\d.]+)px\)/.exec(content.style.transform);
			const translate = match ? Number(match[1]) : 0;
			await expect(translate).toBeLessThanOrEqual(0);
			const reveal = canvasElement.querySelector<HTMLElement>(
				"[data-swipe-reveal]",
			);
			if (!reveal) break;
			const exposed = Number(reveal.dataset.exposed);
			await expect(exposed).toBe(Math.max(0, -translate));
			if (exposed === 0) await expect(reveal.style.visibility).toBe("hidden");
		}
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-swipe-reveal]")).toBeNull(),
		);
	},
};

const drawerReply = fn();
const drawerReact = fn();

export const LongPressDrawer: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		const [pressed, setPressed] = createSignal(false);
		return (
			<HapticsProvider haptics={haptics}>
				<div class="min-h-screen bg-background py-4">
					<MessageGestures
						onLongPress={() => {
							setPressed(true);
							setOpen(true);
						}}
					>
						<div
							data-testid="pressable-row"
							class={pressed() ? "bg-muted/60" : undefined}
						>
							<StandInRow text="Long-press this message for actions." />
						</div>
					</MessageGestures>
					<MessageActionsDrawer
						open={open()}
						onOpenChange={(next) => {
							setOpen(next);
							if (!next) setPressed(false);
						}}
						quickReactions={["👍", "❤️", "😂", "🐦"]}
						onReact={drawerReact}
						onMoreReactions={fn()}
						onEdit={fn()}
						onReply={drawerReply}
						onForward={fn()}
						onOpenThread={fn()}
						onSelect={fn()}
						onCopyText={fn()}
						onHide={fn()}
						onDelete={fn()}
						developer={{
							atUri:
								"at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/social.colibri.beta.message/3lmsg",
							pdslsHref:
								"https://pdsls.dev/at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/social.colibri.beta.message/3lmsg",
						}}
					/>
				</div>
			</HapticsProvider>
		);
	},
	parameters: iphone,
	play: async ({ canvasElement }) => {
		drawerReply.mockClear();
		haptics.impact.mockClear();
		const row = within(canvasElement).getByTestId("pressable-row");
		const rect = row.getBoundingClientRect();
		touch("pointerdown", row, rect.left + 40, rect.top + 20);
		await new Promise((resolve) => setTimeout(resolve, 500));
		await expect(haptics.impact).toHaveBeenCalledWith("medium");
		const dialog = await screen.findByRole("dialog", {
			name: "Message actions",
		});
		touch("pointerup", row, rect.left + 40, rect.top + 20);
		touch("pointerup", document.body, 4, 4);
		document.body.dispatchEvent(
			new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				clientX: 4,
				clientY: 4,
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expect(row).toHaveClass("bg-muted/60");
		await expect(screen.getByRole("dialog", { name: "Message actions" })).toBe(
			dialog,
		);
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Reply" }),
			).toBeVisible(),
		);
		await expect(
			within(dialog).getByRole("button", { name: "React with 🐦" }),
		).toBeVisible();
		const developer = within(dialog).getByRole("region", {
			name: "Developer mode",
		});
		await expect(
			within(developer).getByRole("button", { name: "Copy AT-URI" }),
		).toBeVisible();
		await expect(
			within(developer).getByRole("link", { name: "Show on PDSls" }),
		).toHaveAttribute("href", expect.stringContaining("pdsls.dev"));
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Reply" }),
		);
		await expect(drawerReply).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Message actions" }),
			).toBeNull(),
		);
	},
};

const doubleTapReact = fn();
const doubleTapRaw = fn();
const doubleTapReply = fn();

const DoubleTapDemo = () => {
	const [reactions, setReactions] = createSignal<Reaction[]>([
		{ emoji: "👀", count: 2, reactors: ["Lou", "Kris"] },
	]);
	const [replyingTo, setReplyingTo] = createSignal<string>();
	const react = (emoji: string) => {
		doubleTapReact(emoji);
		setReactions((current) => {
			const existing = current.find((reaction) => reaction.emoji === emoji);
			if (existing?.mine) return current;
			if (existing)
				return current.map((reaction) =>
					reaction.emoji === emoji
						? { ...reaction, count: reaction.count + 1, mine: true }
						: reaction,
				);
			return [...current, { emoji, count: 1, mine: true }];
		});
	};
	const toggle = (emoji: string, mine: boolean) =>
		setReactions((current) =>
			current
				.map((reaction) =>
					reaction.emoji === emoji
						? {
								...reaction,
								mine: !mine,
								count: reaction.count + (mine ? -1 : 1),
							}
						: reaction,
				)
				.filter((reaction) => reaction.count > 0),
		);
	return (
		<div class="flex min-h-screen flex-col gap-6 bg-background py-4">
			<MessageGestures
				doubleTap
				doubleTapAction="react"
				doubleTapEmoji="🐦"
				onReact={react}
				onDoubleTap={doubleTapRaw}
			>
				<div data-testid="tap-row">
					<StandInRow text="Double-tap to react with 🐦." />
				</div>
				<div class="pl-[68px]">
					<ReactionBar reactions={reactions()} onToggle={toggle} />
				</div>
			</MessageGestures>
			<MessageGestures
				doubleTap
				doubleTapAction="editOrReply"
				canEdit={false}
				onReply={() => {
					doubleTapReply();
					setReplyingTo("Lou");
				}}
			>
				<div data-testid="reply-row">
					<StandInRow text="Double-tap someone else's message to reply." />
				</div>
			</MessageGestures>
			<Show when={replyingTo()}>
				{(name) => (
					<div
						data-testid="reply-state"
						class="mx-4 rounded-control bg-info/10 px-3 py-2 text-sm text-foreground"
					>
						Replying to {name()}
					</div>
				)}
			</Show>
		</div>
	);
};

export const DoubleTap: Story = {
	render: () => <DoubleTapDemo />,
	parameters: iphone,
	play: async ({ canvasElement }) => {
		doubleTapReact.mockClear();
		doubleTapRaw.mockClear();
		const row = within(canvasElement).getByTestId("tap-row");
		const rect = row.getBoundingClientRect();
		const x = rect.left + 40;
		const y = rect.top + 20;
		touch("pointerdown", row, x, y);
		touch("pointerup", row, x, y);
		await expect(doubleTapRaw).not.toHaveBeenCalled();
		touch("pointerdown", row, x, y);
		touch("pointerup", row, x, y);
		await expect(doubleTapRaw).toHaveBeenCalledTimes(1);
		await expect(doubleTapReact).toHaveBeenCalledWith("🐦");
		const birdChip = await waitFor(() => {
			const chip = canvasElement.querySelector<HTMLElement>(
				'[data-reaction="🐦"]',
			);
			if (!chip) throw new Error("No 🐦 reaction chip yet");
			return chip;
		});
		await expect(birdChip).toHaveAttribute("aria-pressed", "true");
		await expect(birdChip).toHaveAccessibleName("🐦 1");

		const replyRow = within(canvasElement).getByTestId("reply-row");
		const replyRect = replyRow.getBoundingClientRect();
		const rx = replyRect.left + 40;
		const ry = replyRect.top + 20;
		doubleTapReply.mockClear();
		touch("pointerdown", replyRow, rx, ry);
		touch("pointerup", replyRow, rx, ry);
		touch("pointerdown", replyRow, rx, ry);
		touch("pointerup", replyRow, rx, ry);
		await expect(doubleTapReply).toHaveBeenCalledTimes(1);
		await expect(
			await within(canvasElement).findByTestId("reply-state"),
		).toHaveTextContent("Replying to Lou");
		const surface = canvasElement.querySelector(
			"[data-message-gestures]",
		) as HTMLElement;
		await expect(surface.style.touchAction).toBe("manipulation");
		await expect(surface.style.userSelect).toBe("none");

		doubleTapRaw.mockClear();
		const wait = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms));
		const realTap = async (pressMs: number) => {
			touch("pointerdown", row, x, y);
			row.dispatchEvent(
				new TouchEvent("touchstart", { bubbles: true, cancelable: true }),
			);
			await wait(pressMs);
			touch("pointerup", row, x + 2, y + 1);
			row.dispatchEvent(
				new TouchEvent("touchend", { bubbles: true, cancelable: true }),
			);
			row.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					clientX: x + 2,
					clientY: y + 1,
				}),
			);
		};
		await realTap(110);
		await wait(190);
		await realTap(120);
		await expect(doubleTapRaw).toHaveBeenCalledTimes(1);

		doubleTapRaw.mockClear();
		await realTap(90);
		await wait(420);
		await realTap(90);
		await expect(doubleTapRaw).not.toHaveBeenCalled();
	},
};

type Listener = (event: unknown) => void;

const fakeElement = () => {
	const handlers = new Map<string, Set<Listener>>();
	const element = {
		clientWidth: 400,
		addEventListener: (type: string, handler: Listener) => {
			const set = handlers.get(type) ?? new Set<Listener>();
			set.add(handler);
			handlers.set(type, set);
		},
		removeEventListener: (type: string, handler: Listener) => {
			handlers.get(type)?.delete(handler);
		},
	};
	const dispatch = (type: string, event: Record<string, unknown>) => {
		for (const handler of [...(handlers.get(type) ?? [])]) handler(event);
	};
	return { element: element as unknown as HTMLElement, dispatch, handlers };
};

const fakePointer = (x: number, extra: Record<string, unknown> = {}) => ({
	clientX: x,
	clientY: 0,
	pointerType: "touch",
	stopPropagation: () => {},
	...extra,
});

const withFrames = async (
	run: (frames: {
		flush: () => void;
		cancel: ReturnType<typeof fn>;
		pending: () => number;
	}) => void | Promise<void>,
) => {
	const queued = new Map<number, FrameRequestCallback>();
	let nextId = 1;
	const originalRequest = window.requestAnimationFrame;
	const originalCancel = window.cancelAnimationFrame;
	const cancel = fn((id: number) => {
		queued.delete(id);
	});
	window.requestAnimationFrame = (callback) => {
		const id = nextId++;
		queued.set(id, callback);
		return id;
	};
	window.cancelAnimationFrame = cancel;
	const flush = () => {
		const pending = [...queued.values()];
		queued.clear();
		for (const callback of pending) callback(0);
	};
	try {
		await run({ flush, cancel, pending: () => queued.size });
	} finally {
		window.requestAnimationFrame = originalRequest;
		window.cancelAnimationFrame = originalCancel;
	}
};

export const SwipeUtility: Story = {
	render: () => (
		<p class="p-4 text-sm text-muted-foreground">
			Runs the ported swipe recognizer checks in the play function.
		</p>
	),
	play: async () => {
		await withFrames(({ flush, pending }) => {
			const { element, dispatch } = fakeElement();
			const onSwipeMove = fn();
			createRoot((dispose) => {
				createSwipe(element, { onSwipeRight: () => {}, onSwipeMove });
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointermove", fakePointer(30));
				dispatch("pointermove", fakePointer(50));
				dispatch("pointermove", fakePointer(80));
				expect(onSwipeMove).not.toHaveBeenCalled();
				expect(pending()).toBe(1);
				flush();
				expect(onSwipeMove).toHaveBeenCalledTimes(1);
				expect(onSwipeMove).toHaveBeenCalledWith(80);
				dispose();
			});
		});

		await withFrames(({ flush }) => {
			const { element, dispatch } = fakeElement();
			const onSwipeMove = fn();
			createRoot((dispose) => {
				createSwipe(element, { onSwipeRight: () => {}, onSwipeMove });
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointermove", fakePointer(30));
				flush();
				dispatch("pointermove", fakePointer(60));
				flush();
				expect(onSwipeMove.mock.calls).toEqual([[30], [60]]);
				dispose();
			});
		});

		await withFrames(({ flush }) => {
			const { element, dispatch } = fakeElement();
			const onSwipeMove = fn();
			const onSwipeRight = fn();
			createRoot((dispose) => {
				createSwipe(element, { onSwipeRight, onSwipeMove, commitRatio: 0.45 });
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointermove", fakePointer(300));
				dispatch("pointerup", fakePointer(300));
				expect(onSwipeRight).toHaveBeenCalledTimes(1);
				expect(onSwipeMove).toHaveBeenCalledTimes(1);
				expect(onSwipeMove).toHaveBeenCalledWith(null);
				flush();
				expect(onSwipeMove).toHaveBeenCalledTimes(1);
				dispose();
			});
		});

		await withFrames(({ flush, cancel }) => {
			const { element, dispatch } = fakeElement();
			const onSwipeMove = fn();
			const dispose = createRoot((disposeRoot) => {
				createSwipe(element, { onSwipeRight: () => {}, onSwipeMove });
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointermove", fakePointer(30));
				return disposeRoot;
			});
			dispose();
			expect(cancel).toHaveBeenCalled();
			flush();
			expect(onSwipeMove).not.toHaveBeenCalled();
		});

		await withFrames(() => {
			const { element, dispatch, handlers } = fakeElement();
			createRoot((dispose) => {
				createSwipe(element, {
					onSwipeRight: () => {},
					onSwipeMove: () => {},
				});
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointermove", fakePointer(300));
				dispatch("pointerup", fakePointer(300));
				expect(handlers.get("click")?.size).toBe(1);
				const preventDefault = fn();
				const stopPropagation = fn();
				dispatch("click", { preventDefault, stopPropagation });
				expect(preventDefault).toHaveBeenCalledTimes(1);
				expect(stopPropagation).toHaveBeenCalledTimes(1);
				dispose();
			});
		});

		await withFrames(() => {
			const { element, dispatch, handlers } = fakeElement();
			createRoot((dispose) => {
				createSwipe(element, {
					onSwipeRight: () => {},
					onSwipeMove: () => {},
				});
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointermove", fakePointer(300));
				dispatch("pointerup", fakePointer(300));
				expect(handlers.get("click")?.size).toBe(1);
				dispatch("pointerdown", fakePointer(0, { target: element }));
				expect(handlers.get("click")?.size).toBe(0);
				const preventDefault = fn();
				dispatch("click", { preventDefault, stopPropagation: () => {} });
				expect(preventDefault).not.toHaveBeenCalled();
				dispose();
			});
		});

		await withFrames(() => {
			const { element, dispatch, handlers } = fakeElement();
			createRoot((dispose) => {
				createSwipe(element, {
					onSwipeRight: () => {},
					onSwipeMove: () => {},
				});
				dispatch("pointerdown", fakePointer(0, { target: element }));
				dispatch("pointerup", fakePointer(0));
				expect(handlers.get("click")?.size ?? 0).toBe(0);
				dispose();
			});
		});
	},
};

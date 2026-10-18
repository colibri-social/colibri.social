import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../IconButton/IconButton";
import { type EmojiPick, EmojiPicker } from "./EmojiPicker";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { fixturePacks, fixtureUsage } from "./fixtures";
import type { SkinTone } from "./skin-tone";

const meta = {
	title: "Pickers/Emoji picker",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const onPick = fn();

const describePick = (pick: EmojiPick) =>
	pick.kind === "unicode" ? pick.emoji : `:${pick.emoji.name}:`;

const Surface = (props: { children: import("solid-js").JSX.Element }) => (
	<div class="w-[352px] rounded-surface border border-border bg-popover p-2">
		{props.children}
	</div>
);

const cellCount = (root: HTMLElement) =>
	root.querySelectorAll("[data-cell]").length;

export const Desktop: Story = {
	render: () => {
		const [tone, setTone] = createSignal<SkinTone>(0);
		const [last, setLast] = createSignal("");
		return (
			<div class="flex flex-col gap-3">
				<Surface>
					<EmojiPicker
						usage={fixtureUsage()}
						packs={fixturePacks}
						skinTone={tone()}
						onSkinToneChange={setTone}
						onPick={(pick, event) => {
							onPick(pick, event);
							setLast(describePick(pick));
						}}
					/>
				</Surface>
				<p class="text-sm text-muted-foreground" data-testid="last-pick">
					Last pick: {last()}
				</p>
			</div>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await step("renders lazily", async () => {
			await expect(cellCount(canvasElement)).toBeGreaterThan(0);
			await expect(cellCount(canvasElement)).toBeLessThan(400);
		});
		await step("keeps the stored tone in frequently used", async () => {
			const frequent = canvasElement.querySelector(
				"[data-section='frequent']",
			) as HTMLElement;
			await expect(
				frequent.querySelector("[data-emoji-key='👍🏽']"),
			).not.toBeNull();
		});
		await step("search and pick with Enter", async () => {
			const search = canvas.getByRole("searchbox", { name: "Search emoji" });
			await userEvent.type(search, "salute");
			await waitFor(() =>
				expect(canvasElement.querySelector("[data-cell='0']")).toHaveAttribute(
					"data-emoji-key",
					"🫡",
				),
			);
			await userEvent.keyboard("{Enter}");
			await expect(onPick).toHaveBeenLastCalledWith(
				{ kind: "unicode", emoji: "🫡", shortcode: "salute" },
				expect.anything(),
			);
			await userEvent.clear(search);
		});
		await step("arrow keys move through the grid", async () => {
			const search = canvas.getByRole("searchbox", { name: "Search emoji" });
			search.focus();
			await userEvent.keyboard("{ArrowDown}");
			await expect(document.activeElement).toHaveAttribute("data-cell", "0");
			await userEvent.keyboard("{ArrowRight}");
			await expect(document.activeElement).toHaveAttribute("data-cell", "1");
			await userEvent.keyboard("{ArrowDown}");
			await expect(
				Number(document.activeElement?.getAttribute("data-cell")),
			).toBeGreaterThan(1);
			await userEvent.keyboard("{ArrowUp}");
			await expect(document.activeElement).toHaveAttribute("data-cell", "1");
		});
		await step("custom emoji pick", async () => {
			await userEvent.click(canvas.getByRole("button", { name: ":tux:" }));
			await expect(canvas.getByTestId("last-pick")).toHaveTextContent(
				"Last pick: :tux:",
			);
		});
	},
};

export const CategoryRail: Story = {
	render: () => (
		<Surface>
			<EmojiPicker onPick={onPick} packs={fixturePacks} />
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const rail = canvas.getByRole("navigation", { name: "Emoji categories" });
		const flags = within(rail).getByRole("button", { name: "Flags" });
		await userEvent.click(flags);
		await expect(flags).toHaveAttribute("aria-current", "true");
		const section = canvasElement.querySelector(
			"[data-section='flags']",
		) as HTMLElement;
		await waitFor(() =>
			expect(section.querySelector("[data-cell]")).not.toBeNull(),
		);
		const scroller = canvasElement.querySelector(
			"[data-emoji-scroller]",
		) as HTMLElement;
		await expect(Math.abs(scroller.scrollTop - section.offsetTop)).toBeLessThan(
			2,
		);
		scroller.scrollTop = 0;
		await waitFor(() =>
			expect(
				within(rail).getByRole("button", { name: "Frequently used" }),
			).toHaveAttribute("aria-current", "true"),
		);
	},
};

export const StickyHeaderFlush: Story = {
	render: () => (
		<Surface>
			<EmojiPicker onPick={onPick} />
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const scroller = canvasElement.querySelector(
			"[data-emoji-scroller]",
		) as HTMLElement;
		const section = canvasElement.querySelector(
			"[data-section='smileys_emotion']",
		) as HTMLElement;
		await waitFor(() =>
			expect(section.querySelector("[data-cell]")).not.toBeNull(),
		);
		scroller.scrollTop = section.offsetTop + 90;
		const header = section.querySelector(
			"[data-section-header]",
		) as HTMLElement;
		await waitFor(() => {
			const viewport = scroller.getBoundingClientRect();
			const top = header.getBoundingClientRect().top;
			expect(Math.abs(top - viewport.top)).toBeLessThan(0.5);
		});
		const viewport = scroller.getBoundingClientRect();
		const headerBox = header.getBoundingClientRect();
		for (const y of [
			viewport.top + 0.5,
			viewport.top + 2,
			headerBox.bottom - 1,
		]) {
			const hit = document.elementFromPoint(
				viewport.left + viewport.width / 2,
				y,
			);
			await expect(header.contains(hit)).toBe(true);
		}
		await expect(getComputedStyle(header).backgroundColor).not.toBe(
			"rgba(0, 0, 0, 0)",
		);
	},
};

const onToneChange = fn();

export const SkinTones: Story = {
	render: () => {
		const [tone, setTone] = createSignal<SkinTone>(0);
		return (
			<Surface>
				<EmojiPicker
					onPick={onPick}
					skinTone={tone()}
					onSkinToneChange={(next) => {
						onToneChange(next);
						setTone(next);
					}}
				/>
			</Surface>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Skin tone: Default" }),
		);
		const dark = await canvas.findByRole("button", { name: "Dark" });
		await waitFor(() =>
			expect(canvas.getByRole("button", { name: "Default" })).toHaveFocus(),
		);
		await userEvent.keyboard("{ArrowLeft}");
		await expect(dark).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(onToneChange).toHaveBeenLastCalledWith(5);
		await expect(
			canvas.getByRole("button", { name: "Skin tone: Dark" }),
		).toHaveFocus();
		await userEvent.type(
			canvas.getByRole("searchbox", { name: "Search emoji" }),
			"thumbs up",
		);
		await waitFor(() =>
			expect(canvasElement.querySelector("[data-cell='0']")).toHaveAttribute(
				"data-emoji-key",
				"👍🏿",
			),
		);
	},
};

export const NoResults: Story = {
	render: () => (
		<Surface>
			<EmojiPicker onPick={onPick} />
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			canvas.getByRole("searchbox", { name: "Search emoji" }),
			"zzqqxx",
		);
		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"No emoji found",
		);
		await expect(
			canvas.queryByRole("navigation", { name: "Emoji categories" }),
		).not.toBeInTheDocument();
	},
};

export const Popover: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		return (
			<div class="flex min-h-[520px] items-end justify-end p-4">
				<EmojiPickerPopover
					open={open()}
					onOpenChange={setOpen}
					onPick={onPick}
					usage={fixtureUsage()}
					anchor={
						<IconButton
							variant="ghost"
							label="Add an emoji"
							icon={<SmileCircleIcon />}
							onClick={() => setOpen((value) => !value)}
						/>
					}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Add an emoji",
		});
		await userEvent.click(trigger);
		const dialog = await screen.findByRole("dialog", { name: "Emoji picker" });
		await waitFor(() =>
			expect(
				within(dialog).getByRole("searchbox", { name: "Search emoji" }),
			).toHaveFocus(),
		);
		const fire = within(dialog).getAllByRole("button", { name: "fire" })[0];
		await userEvent.keyboard("{Shift>}");
		await userEvent.click(fire);
		await userEvent.keyboard("{/Shift}");
		await expect(screen.getByRole("dialog")).toBeInTheDocument();
		await userEvent.click(fire);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await waitFor(() => expect(trigger).toHaveFocus());
		await userEvent.click(trigger);
		await screen.findByRole("dialog");
		await userEvent.click(trigger);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const MobileDrawer: Story = {
	parameters: iphone,
	render: () => {
		const [open, setOpen] = createSignal(false);
		return (
			<div class="flex min-h-[600px] items-end p-4">
				<EmojiPickerPopover
					platform="mobile"
					open={open()}
					onOpenChange={setOpen}
					onPick={onPick}
					usage={fixtureUsage()}
					packs={fixturePacks}
					anchor={
						<IconButton
							variant="ghost"
							label="Add an emoji"
							icon={<SmileCircleIcon />}
							onClick={() => setOpen(true)}
						/>
					}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Add an emoji" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Emoji picker" });
		await waitFor(() => expect(dialog).toHaveFocus());
		await expect(document.activeElement).not.toHaveAttribute("type", "search");
		await expect(
			dialog.querySelector("[data-emoji-preview]"),
		).not.toBeInTheDocument();
		await waitFor(() =>
			expect(
				dialog
					.querySelector<HTMLElement>("[data-cell]")
					?.getBoundingClientRect().height,
			).toBeGreaterThanOrEqual(44),
		);
		const cell = dialog.querySelector<HTMLElement>("[data-cell]");
		await userEvent.click(cell as HTMLElement);
		await waitFor(
			() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			{ timeout: 6000 },
		);
	},
};

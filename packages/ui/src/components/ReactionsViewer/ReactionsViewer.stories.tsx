import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { type Reaction, ReactionBar } from "../MessageActions/ReactionBar";
import { type ReactionGroup, ReactionsViewer } from "./ReactionsViewer";

const meta = {
	title: "Messaging/Reactions viewer",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };
const onRemove = fn();
const onOpenProfile = fn();

const fixtureReactions = (): ReactionGroup[] => [
	{
		emoji: "🔥",
		count: 4,
		reactors: [
			{ id: "lou", name: "Lou", handle: "lou.gg", mine: true },
			{
				id: "ana",
				name: "Ana Lima",
				handle: "ana.bsky.social",
				avatarSrc: storyImages.violetIcon(),
			},
			{ id: "ben", name: "Ben", handle: "ben.colibri.social" },
			{ id: "matrix", name: "kai", via: "Matrix" },
		],
	},
	{
		emoji: "🐦",
		count: 9,
		loading: true,
		reactors: [{ id: "cam", name: "Cam", handle: "cam.dev" }],
	},
	{
		emoji: "tux",
		name: "tux",
		src: storyImages.tealIcon(),
		count: 3,
		reactors: [{ id: "dee", name: "Dee", handle: "dee.example" }],
	},
];

const Harness = (props: { platform: "mobile" | "desktop" }) => {
	const [open, setOpen] = createSignal(false);
	const [active, setActive] = createSignal<string>();
	return (
		<>
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Show reactions
			</Button>
			<ReactionsViewer
				platform={props.platform}
				open={open()}
				onOpenChange={setOpen}
				reactions={fixtureReactions()}
				active={active()}
				onActiveChange={setActive}
				onRemove={onRemove}
				onOpenProfile={onOpenProfile}
			/>
		</>
	);
};

export const Desktop: Story = {
	render: () => <Harness platform="desktop" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Show reactions" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Reactions" });
		const tabs = within(dialog).getByRole("tablist", { name: "Reactions" });
		await expect(tabs).toHaveAttribute("aria-orientation", "vertical");
		await expect(
			within(dialog).getByRole("tab", { name: "🔥, 4 reactions" }),
		).toHaveAttribute("aria-selected", "true");
		await waitFor(() =>
			expect(within(dialog).getByText("via Matrix")).toBeVisible(),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Remove your reaction" }),
		);
		await expect(onRemove).toHaveBeenCalledWith("🔥");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /Ana Lima/ }),
		);
		await expect(onOpenProfile).toHaveBeenCalledWith(
			expect.objectContaining({ id: "ana" }),
		);
		await userEvent.click(
			within(dialog).getByRole("tab", { name: "🐦, 9 reactions" }),
		);
		const panel = within(dialog).getByRole("tabpanel");
		await expect(panel.querySelector("[data-reactor='cam']")).not.toBeNull();
		await expect(
			panel.querySelectorAll("[data-reactor-skeletons] > div"),
		).toHaveLength(6);
		await userEvent.click(
			within(dialog).getByRole("tab", { name: ":tux:, 3 reactions" }),
		);
		await expect(within(dialog).getByText("2 more people")).toBeVisible();
	},
};

export const Mobile: Story = {
	parameters: iphone,
	render: () => <Harness platform="mobile" />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Show reactions" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Reactions" });
		const tabs = within(dialog).getByRole("tablist", { name: "Reactions" });
		await expect(tabs).toHaveAttribute("aria-orientation", "horizontal");
		const row = dialog.querySelector("[data-reactor='ana']") as HTMLElement;
		await expect(row.getBoundingClientRect().height).toBe(56);
		const remove = within(dialog).getByRole("button", {
			name: "Remove your reaction",
		});
		await expect(remove.getBoundingClientRect().width).toBeGreaterThanOrEqual(
			40,
		);
	},
};

const brokenEmojiRefresh = fn();

const CustomEmojiHarness = () => {
	const [open, setOpen] = createSignal(false);
	const [owl, setOwl] = createSignal("/expired-owl.png");
	const reactor = (id: string) => [{ id, name: id, handle: `${id}.test` }];
	return (
		<>
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Show reactions
			</Button>
			<ReactionsViewer
				platform="mobile"
				open={open()}
				onOpenChange={setOpen}
				reactions={[
					{
						emoji: ":owl:",
						name: "owl",
						src: owl(),
						custom: true,
						count: 1,
						reactors: reactor("ana"),
					},
					{
						emoji: ":deleted:",
						name: "deleted",
						src: "/deleted-emoji.png",
						custom: true,
						count: 1,
						reactors: reactor("ben"),
					},
					{
						emoji: ":loading:",
						custom: true,
						count: 1,
						reactors: reactor("cam"),
					},
					{
						emoji: ":removed:",
						custom: true,
						unavailable: true,
						count: 1,
						reactors: reactor("dee"),
					},
				]}
				onEmojiError={async (emoji, src) => {
					brokenEmojiRefresh(emoji, src);
					if (emoji !== ":owl:") return false;
					setOwl(storyImages.tealIcon());
					return true;
				}}
			/>
		</>
	);
};

export const CustomEmojiPlaceholders: Story = {
	parameters: iphone,
	render: () => <CustomEmojiHarness />,
	play: async ({ canvasElement }) => {
		brokenEmojiRefresh.mockClear();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Show reactions" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Reactions" });
		const tabs = within(dialog).getByRole("tablist", { name: "Reactions" });
		const glyph = (name: string) =>
			tabs.querySelector<HTMLElement>(`[data-custom-emoji-image="${name}"]`);
		await waitFor(() =>
			expect(brokenEmojiRefresh).toHaveBeenCalledWith(
				":deleted:",
				"/deleted-emoji.png",
			),
		);
		await waitFor(() =>
			expect(glyph("deleted")).toHaveAttribute("data-custom-emoji-unavailable"),
		);
		await waitFor(() =>
			expect(glyph("owl")).not.toHaveAttribute("data-custom-emoji-pending"),
		);
		await expect(
			glyph("owl")?.querySelector("img")?.getAttribute("src"),
		).not.toBe("/expired-owl.png");
		await expect(brokenEmojiRefresh).toHaveBeenCalledWith(
			":owl:",
			"/expired-owl.png",
		);
		await expect(glyph("loading")).toHaveAttribute("data-skeleton");
		await expect(glyph("removed")).toHaveAttribute(
			"data-custom-emoji-unavailable",
		);
		await expect(glyph("removed")).not.toHaveAttribute("data-skeleton");
		for (const name of ["owl", "deleted", "loading", "removed"]) {
			const box = glyph(name)?.getBoundingClientRect();
			await expect(Math.round(box?.width ?? 0)).toBe(20);
			await expect(Math.round(box?.height ?? 0)).toBe(20);
		}
		await expect(tabs.textContent).not.toMatch(/:\w+:/);
		await expect(
			within(dialog).getByRole("tab", { name: ":deleted:, 1 reaction" }),
		).toBeVisible();
		await expectNoLayoutIssues(dialog);
	},
};

export const FromReactionBar: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		const [active, setActive] = createSignal<string>();
		const groups = fixtureReactions();
		const reactions: Reaction[] = groups
			.filter((group) => !group.src)
			.map((group) => ({
				emoji: group.emoji,
				count: group.count,
				mine: group.reactors.some((reactor) => reactor.mine),
				reactors: group.reactors.map((reactor) => reactor.name),
			}));
		return (
			<div class="bg-background p-4">
				<ReactionBar
					reactions={reactions}
					onShowReactors={(emoji) => {
						setActive(emoji);
						setOpen(true);
					}}
				/>
				<p class="pt-2 text-xs text-muted-foreground">
					Press and hold a reaction to see who reacted.
				</p>
				<ReactionsViewer
					platform="mobile"
					open={open()}
					onOpenChange={setOpen}
					reactions={groups}
					active={active()}
					onActiveChange={setActive}
				/>
			</div>
		);
	},
	parameters: iphone,
	play: async ({ canvasElement }) => {
		const chip = canvasElement.querySelector(
			"[data-reaction='🐦']",
		) as HTMLElement;
		const rect = chip.getBoundingClientRect();
		const init = {
			bubbles: true,
			pointerType: "touch",
			pointerId: 3,
			isPrimary: true,
			clientX: rect.left + 4,
			clientY: rect.top + 4,
		};
		chip.dispatchEvent(new PointerEvent("pointerdown", init));
		await new Promise((resolve) => setTimeout(resolve, 500));
		chip.dispatchEvent(new PointerEvent("pointerup", init));
		const dialog = await screen.findByRole("dialog", { name: "Reactions" });
		await waitFor(() =>
			expect(
				within(dialog).getByRole("tab", { name: "🐦, 9 reactions" }),
			).toHaveAttribute("aria-selected", "true"),
		);
	},
};

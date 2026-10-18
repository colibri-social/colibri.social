import { createSignal, type JSX } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectFocusRingVisible } from "../../foundations/focus-ring-test";
import { GifGlyph } from "../../icons/animated/brand";
import { IconButton } from "../IconButton/IconButton";
import { createFakeGifSource, fixtureGifs } from "./fixtures";
import { type Gif, GifPicker, type GifPickerProps } from "./GifPicker";
import { GifPickerPopover } from "./GifPickerPopover";

const meta = {
	title: "Pickers/GIF picker",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };
const onPick = fn();

const Surface = (props: { children: JSX.Element; wide?: boolean }) => (
	<div
		class={
			props.wide
				? "w-full max-w-[402px] bg-popover p-4"
				: "w-[352px] rounded-surface border border-border bg-popover p-2"
		}
	>
		{props.children}
	</div>
);

const WithFavorites = (
	props: Omit<GifPickerProps, "onPick" | "favorites" | "onToggleFavorite">,
) => {
	const [favorites, setFavorites] = createSignal<Gif[]>([]);
	return (
		<GifPicker
			{...props}
			onPick={onPick}
			favorites={favorites()}
			onToggleFavorite={(gif, favorite) =>
				setFavorites((list) =>
					favorite ? [gif, ...list] : list.filter((item) => item.id !== gif.id),
				)
			}
		/>
	);
};

const tiles = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-gif-tile]"));

export const Desktop: Story = {
	render: () => {
		const source = createFakeGifSource();
		return (
			<Surface>
				<WithFavorites
					source={source}
					recents={fixtureGifs(3, 40, "recent")}
					attribution="Powered by KLIPY"
				/>
			</Surface>
		);
	},
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await step("shows skeletons, then a masonry grid", async () => {
			await waitFor(() =>
				expect(
					canvasElement.querySelector("[data-gif-skeleton]"),
				).not.toBeNull(),
			);
			await canvas.findByRole("button", { name: "Trending GIF 1" });
			await waitFor(() => expect(canvas.getByText("Recent")).toBeVisible());
		});
		await step("loads the next page near the bottom", async () => {
			const scroller = canvasElement.querySelector(
				"[data-gif-scroller]",
			) as HTMLElement;
			scroller.scrollTop = scroller.scrollHeight;
			await canvas.findByRole(
				"button",
				{ name: "Trending GIF 13" },
				{
					timeout: 3000,
				},
			);
			await expect(
				new Set(tiles(canvasElement).map((tile) => tile.dataset.gifTile)).size,
			).toBe(tiles(canvasElement).length);
		});
		await step("favorite with the star", async () => {
			const tile = canvasElement.querySelector(
				"[data-gif-tile='gif-0']",
			) as HTMLElement;
			const star = within(tile).getByRole("button", { name: "Favorite" });
			await userEvent.click(star);
			await expect(star).toHaveAttribute("aria-pressed", "true");
			await expect(onPick).not.toHaveBeenCalled();
			await userEvent.click(canvas.getByRole("radio", { name: "Favorites" }));
			await canvas.findByRole("button", { name: "Trending GIF 1" });
			await expect(tiles(canvasElement)).toHaveLength(1);
		});
		await step("pick", async () => {
			await userEvent.click(
				canvas.getByRole("button", { name: "Trending GIF 1" }),
			);
			await expect(onPick).toHaveBeenCalledWith(
				expect.objectContaining({ id: "gif-0" }),
				expect.anything(),
			);
		});
	},
};

export const SearchKeepsLatestResults: Story = {
	render: () => {
		const source = createFakeGifSource({
			searchDelay: (query) => (query === "slow" ? 900 : 50),
			delay: 50,
		});
		return (
			<Surface>
				<WithFavorites source={source} debounce={30} />
			</Surface>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const search = canvas.getByRole("searchbox", { name: "Search GIFs" });
		await userEvent.type(search, "slow");
		await new Promise((resolve) => setTimeout(resolve, 120));
		await expect(
			canvas.queryByRole("radiogroup", { name: "GIF sections" }),
		).not.toBeInTheDocument();
		await userEvent.clear(search);
		await userEvent.type(search, "fast");
		await canvas.findByRole("button", { name: "fast GIF 1" });
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await expect(
			canvas.queryByRole("button", { name: "slow GIF 1" }),
		).not.toBeInTheDocument();
		await userEvent.clear(search);
		await canvas.findByRole("radiogroup", { name: "GIF sections" });
	},
};

export const Categories: Story = {
	render: () => (
		<Surface>
			<WithFavorites source={createFakeGifSource({ delay: 80 })} />
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("radio", { name: "Categories" }));
		await userEvent.click(await canvas.findByRole("button", { name: "dance" }));
		await expect(
			canvas.getByRole("searchbox", { name: "Search GIFs" }),
		).toHaveValue("dance");
		await canvas.findByRole("button", { name: "dance GIF 1" });
	},
};

export const Errors: Story = {
	render: () => (
		<Surface>
			<WithFavorites
				source={createFakeGifSource({
					delay: 50,
					fail: { trending: true, categories: true },
				})}
			/>
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByText("Couldn’t load GIFs.");
		await expect(
			canvas.getByRole("button", { name: "Try again" }),
		).toBeVisible();
		await userEvent.click(canvas.getByRole("radio", { name: "Categories" }));
		await canvas.findByText("Couldn’t load categories.");
	},
};

export const MobileLongPress: Story = {
	parameters: iphone,
	render: () => (
		<Surface wide>
			<WithFavorites
				source={createFakeGifSource({ delay: 50 })}
				platform="mobile"
			/>
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = await canvas.findByRole("button", {
			name: "Trending GIF 2",
		});
		const tile = button.closest("[data-gif-tile]") as HTMLElement;
		const star = within(tile).getByRole("button", { name: "Favorite" });
		await expect(star.getBoundingClientRect().width).toBeGreaterThanOrEqual(36);
		const rect = button.getBoundingClientRect();
		const init = {
			bubbles: true,
			pointerType: "touch",
			pointerId: 7,
			isPrimary: true,
			clientX: rect.left + 10,
			clientY: rect.top + 10,
		};
		button.dispatchEvent(new PointerEvent("pointerdown", init));
		await new Promise((resolve) => setTimeout(resolve, 500));
		button.dispatchEvent(new PointerEvent("pointerup", init));
		button.click();
		await waitFor(() => expect(star).toHaveAttribute("aria-pressed", "true"));
		await expect(onPick).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: "gif-1" }),
			expect.anything(),
		);
	},
};

export const Popover: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		return (
			<div class="flex min-h-[520px] items-end justify-end p-4">
				<GifPickerPopover
					open={open()}
					onOpenChange={setOpen}
					onPick={onPick}
					source={createFakeGifSource({ delay: 50 })}
					anchor={
						<IconButton
							variant="ghost"
							label="Send a GIF"
							icon={<GifGlyph />}
							onClick={() => setOpen((value) => !value)}
						/>
					}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Send a GIF",
		});
		await userEvent.click(trigger);
		const dialog = await screen.findByRole("dialog", { name: "GIF picker" });
		await userEvent.click(
			await within(dialog).findByRole("button", { name: "Trending GIF 1" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

export const FocusRingNotClipped: Story = {
	render: () => (
		<Surface>
			<WithFavorites
				source={createFakeGifSource()}
				attribution="Powered by KLIPY"
			/>
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const tile = await canvas.findByRole(
			"button",
			{ name: "Trending GIF 1" },
			{ timeout: 3000 },
		);
		await expectFocusRingVisible(tile);
	},
};

const pickButtons = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-gif-pick]"));

const columnOf = (element: HTMLElement, root: HTMLElement) => {
	const grid = (
		root.querySelector("[data-gif-masonry]") as HTMLElement
	).getBoundingClientRect();
	const box = element.getBoundingClientRect();
	return box.left + box.width / 2 < grid.left + grid.width / 2 ? 0 : 1;
};

export const ReadingOrder: Story = {
	render: () => (
		<Surface>
			<GifPicker
				source={createFakeGifSource()}
				attribution="Powered by KLIPY"
				onPick={fn()}
			/>
		</Surface>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByRole(
			"button",
			{ name: "Trending GIF 6" },
			{ timeout: 3000 },
		);
		const buttons = pickButtons(canvasElement).slice(0, 6);
		buttons[0].focus();
		const visited: HTMLElement[] = [buttons[0]];
		for (let step = 1; step < 6; step++) {
			await userEvent.tab();
			visited.push(document.activeElement as HTMLElement);
		}
		const columns = visited.map((element) => columnOf(element, canvasElement));
		await expect(columns).toEqual([0, 1, 0, 1, 0, 1]);
		const tops = visited.map((element) => element.getBoundingClientRect().top);
		for (let index = 1; index < tops.length; index++)
			await expect(tops[index]).toBeGreaterThanOrEqual(tops[index - 1] - 1);

		buttons[0].focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(
			columnOf(document.activeElement as HTMLElement, canvasElement),
		).toBe(1);
		await userEvent.keyboard("{ArrowLeft}");
		await expect(document.activeElement).toBe(buttons[0]);
		await userEvent.keyboard("{ArrowDown}");
		const below = document.activeElement as HTMLElement;
		await expect(columnOf(below, canvasElement)).toBe(0);
		await expect(below.getBoundingClientRect().top).toBeGreaterThan(
			buttons[0].getBoundingClientRect().top,
		);
		await userEvent.keyboard("{ArrowUp}");
		await expect(document.activeElement).toBe(buttons[0]);
	},
};

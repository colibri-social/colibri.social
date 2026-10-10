import { createSignal, For } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta = {
	title: "Primitives/Tabs",
	component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const indicator = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-tabs-indicator]");

export const Horizontal: Story = {
	render: () => (
		<div class="w-80 bg-popover p-4">
			<Tabs defaultValue="emoji">
				<TabsList aria-label="Picker">
					<TabsTrigger value="emoji">Emoji</TabsTrigger>
					<TabsTrigger value="gif">GIF</TabsTrigger>
					<TabsTrigger value="stickers">Stickers</TabsTrigger>
				</TabsList>
				<TabsContent value="emoji" class="pt-4 text-sm">
					Emoji grid
				</TabsContent>
				<TabsContent value="gif" class="pt-4 text-sm">
					GIF grid
				</TabsContent>
				<TabsContent value="stickers" class="pt-4 text-sm">
					Stickers
				</TabsContent>
			</Tabs>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const gif = canvas.getByRole("tab", { name: "GIF" });
		await userEvent.click(gif);
		await expect(gif).toHaveAttribute("aria-selected", "true");
		await expect(canvas.getByRole("tabpanel")).toHaveTextContent("GIF grid");
		await waitFor(
			() => {
				expect(indicator(canvasElement)?.style.width).toBe(
					`${gif.offsetWidth}px`,
				);
				expect(indicator(canvasElement)?.style.transform).toBe(
					`translateX(${gif.offsetLeft}px)`,
				);
			},
			{ timeout: 3000 },
		);
		await userEvent.keyboard("{ArrowRight}");
		await expect(canvas.getByRole("tab", { name: "Stickers" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	},
};

export const Vertical: Story = {
	render: () => {
		const [value, setValue] = createSignal("general");
		return (
			<div class="w-96 bg-popover p-4">
				<Tabs value={value()} onChange={setValue} orientation="vertical">
					<TabsList aria-label="Settings" class="w-36">
						<For each={["general", "roles", "emoji", "bridges"]}>
							{(item) => (
								<TabsTrigger value={item} class="capitalize">
									{item}
								</TabsTrigger>
							)}
						</For>
					</TabsList>
					<TabsContent value={value()} class="px-4 text-sm capitalize">
						{value()}
					</TabsContent>
				</Tabs>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const general = canvas.getByRole("tab", { name: "general" });
		const roles = canvas.getByRole("tab", { name: "roles" });
		await expect(indicator(canvasElement)).not.toBeVisible();
		await userEvent.click(roles);
		await expect(roles).toHaveAttribute("data-selected");
		await expect(general).not.toHaveAttribute("data-selected");
		await expect(getComputedStyle(roles).transitionProperty).toBe(
			"background-color",
		);
		await waitFor(() =>
			expect(getComputedStyle(general).backgroundColor).toBe(
				"rgba(0, 0, 0, 0)",
			),
		);
	},
};

export const ManyTabsScroll: Story = {
	render: () => (
		<div class="w-72 bg-popover p-4">
			<Tabs defaultValue="t0">
				<TabsList aria-label="Reactions">
					<For each={Array.from({ length: 12 }, (_, index) => index)}>
						{(index) => (
							<TabsTrigger value={`t${index}`}>Tab {index + 1}</TabsTrigger>
						)}
					</For>
				</TabsList>
			</Tabs>
		</div>
	),
	play: async ({ canvasElement }) => {
		const list = canvasElement.querySelector<HTMLElement>("[data-tabs-list]");
		await expect(list?.scrollWidth).toBeGreaterThan(list?.clientWidth ?? 0);
		const last = within(canvasElement).getByRole("tab", { name: "Tab 12" });
		await userEvent.click(last);
		await waitFor(() =>
			expect(indicator(canvasElement)?.style.transform).toBe(
				`translateX(${last.offsetLeft}px)`,
			),
		);
	},
};

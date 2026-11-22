import { createSignal } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	BridgeOverview,
	type ConnectedBridge,
	type FeaturedBridge,
} from "./BridgeOverview";

const meta = {
	title: "Surfaces/Bridges",
	component: BridgeOverview,
	decorators: [
		(Story) => (
			<div class="min-h-dvh bg-popover p-6 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof BridgeOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const connected: ConnectedBridge[] = [
	{
		id: "matrix",
		name: "Matrix",
		verified: true,
		service: "did:web:matrix-bridge.example.social",
		bridgedWith: "Lou's server",
	},
	{
		id: "minecraft-survival",
		featuredId: "minecraft",
		name: "Minecraft",
		service: "did:web:mc.blockbuilder.example.com",
		bridgedWith: "Survival world with a much longer name than usual",
	},
];

const featured: FeaturedBridge[] = [
	{
		id: "matrix",
		name: "Matrix",
		verified: true,
		author: "Colibri Social",
		features: [
			{ label: "Bi-directional messages", support: "full" },
			{ label: "Bi-directional message moderation", support: "full" },
		],
	},
	{
		id: "slack",
		name: "Slack",
		verified: true,
		author: "Colibri Social",
		features: [
			{ label: "Import messages from Slack", support: "partial" },
			{ label: "No moderation", support: "none" },
		],
	},
	{
		id: "minecraft",
		name: "Minecraft",
		author: "@blockbuilder.example.com",
		features: [
			{ label: "Bi-directional messages", support: "full" },
			{
				label: "Can't moderate messages sent from the game",
				support: "none",
			},
			{ label: "Player join and leave events", support: "partial" },
		],
	},
];

const onConnect = fn();
const onMenu = fn();
const onHaveCode = fn();

const tops = (elements: Element[]) =>
	elements.map((element) => Math.round(element.getBoundingClientRect().top));

const splitColumns = (canvasElement: HTMLElement) => {
	const nav = canvasElement.querySelector(
		"[data-bridge-split-nav]",
	) as HTMLElement;
	const pane = canvasElement.querySelector(
		"[data-bridge-split-pane]",
	) as HTMLElement;
	return {
		nav: nav.getBoundingClientRect(),
		pane: pane.getBoundingClientRect(),
	};
};

const expectSideBySide = async (canvasElement: HTMLElement) => {
	const { nav, pane } = splitColumns(canvasElement);
	await expect(Math.round(pane.top)).toBe(Math.round(nav.top));
	await expect(pane.left).toBeGreaterThanOrEqual(nav.right);
	await expect(pane.width).toBeGreaterThan(nav.width);
};

export const Desktop: Story = {
	args: {
		platform: "desktop",
		connected,
		featured,
		onConnect,
		onBridgeMenu: onMenu,
		onHaveCode,
	},
	render: (args) => (
		<div class="mx-auto w-full max-w-[880px]">
			<BridgeOverview {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		onConnect.mockClear();
		onMenu.mockClear();
		onHaveCode.mockClear();
		const canvas = within(canvasElement);
		const tabs = within(
			canvas.getByRole("tablist", { name: "Bridges" }),
		).getAllByRole("tab");
		await expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
			"Matrix",
			"Minecraft",
			"Add a bridge",
		]);
		await expect(tabs[0]).toHaveAttribute("aria-selected", "true");
		await expectSideBySide(canvasElement);
		await expect(
			canvas.getByRole("heading", { level: 2, name: /Matrix/ }),
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "More actions for Matrix bridge" }),
		);
		await expect(onMenu).toHaveBeenCalledWith("matrix", expect.anything());
		await userEvent.click(tabs[1]);
		await waitFor(() =>
			expect(
				canvas.getByRole("heading", { level: 2, name: "Minecraft" }),
			).toBeVisible(),
		);
		await expect(canvas.getByText("@blockbuilder.example.com")).toBeVisible();
		await expect(
			canvas.getByText("Player join and leave events"),
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", {
				name: "More actions for Minecraft bridge",
			}),
		);
		await expect(onMenu).toHaveBeenCalledWith(
			"minecraft-survival",
			expect.anything(),
		);
		tabs[1].focus();
		await userEvent.keyboard("{ArrowDown}");
		await waitFor(() =>
			expect(
				canvas.getByRole("heading", { level: 2, name: "Add a bridge" }),
			).toBeVisible(),
		);
		await expect(tabs[2]).toHaveAttribute("aria-selected", "true");
		await userEvent.click(
			canvas.getByRole("button", { name: "I have a code" }),
		);
		await expect(onHaveCode).toHaveBeenCalledTimes(1);
		canvas.getByRole("button", { name: "Connect Slack" }).focus();
		await userEvent.keyboard("{Enter}");
		await expect(onConnect).toHaveBeenCalledWith("slack");
	},
};

export const DesktopNarrowModal: Story = {
	args: {
		platform: "desktop",
		connected,
		featured,
		onHaveCode,
	},
	render: (args) => (
		<div class="w-[600px]">
			<BridgeOverview {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await expectSideBySide(canvasElement);
		const { pane } = splitColumns(canvasElement);
		const root = canvasElement.querySelector(
			"[data-bridge-overview]",
		) as HTMLElement;
		await expect(pane.right).toBeLessThanOrEqual(
			root.getBoundingClientRect().right + 0.5,
		);
	},
};

export const DesktopConnecting: Story = {
	args: { platform: "desktop", connected: [], featured },
	render: (args) => {
		const [connecting, setConnecting] = createSignal<string>();
		return (
			<div class="mx-auto w-full max-w-[880px]">
				<BridgeOverview
					{...args}
					connecting={connecting()}
					onConnect={(id) => setConnecting(id)}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("No bridges yet")).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "Connect Matrix" }),
		);
		await waitFor(() =>
			expect(
				canvas.getByRole("button", { name: "Connect Slack" }),
			).toBeDisabled(),
		);
	},
};

export const DesktopLoading: Story = {
	args: { platform: "desktop", loading: true, connected: [], featured: [] },
	render: (args) => (
		<div class="mx-auto w-full max-w-[880px]">
			<BridgeOverview {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const group = canvasElement.querySelector("[data-skeleton-group]");
		await expect(group).toHaveAttribute("aria-busy", "true");
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			"Loading bridges",
		);
	},
};

export const Empty: Story = {
	args: { platform: "desktop", connected: [], featured: [], onHaveCode },
	render: (args) => (
		<div class="mx-auto w-full max-w-[880px]">
			<BridgeOverview {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("No bridges yet")).toBeVisible();
		await expect(
			canvas.getByText("No featured bridges right now"),
		).toBeVisible();
	},
};

export const Mobile: Story = {
	parameters: iphone,
	args: {
		platform: "mobile",
		connected,
		featured,
		onConnect,
		onHaveCode,
	},
	play: async ({ canvasElement }) => {
		const cards = Array.from(
			(
				canvasElement.querySelector(
					'[data-bridge-grid="featured"]',
				) as HTMLElement
			).children,
		);
		const lefts = cards.map((card) =>
			Math.round(card.getBoundingClientRect().left),
		);
		await expect(new Set(lefts).size).toBe(1);
		const rowTops = tops(cards);
		await expect(rowTops[1]).toBeGreaterThan(rowTops[0]);
		await expect(rowTops[2]).toBeGreaterThan(rowTops[1]);
	},
};

export const MobileLoading: Story = {
	parameters: iphone,
	args: { platform: "mobile", loading: true, connected: [], featured: [] },
};

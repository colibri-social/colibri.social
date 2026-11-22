import { HomeSmileIcon } from "@solar-icons/solid/bold/home-smile";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createSignal, For, onCleanup, onMount } from "solid-js";
import { expect, screen, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../components/Button/Button";
import {
	Drawer,
	DrawerContent,
	DrawerTrigger,
} from "../components/Drawer/Drawer";
import { NavHeader } from "../components/Header/NavHeader";
import { TabBar } from "../components/TabBar/TabBar";
import {
	applySafeAreaInsets,
	readSafeAreaInsets,
	type SafeAreaInsets,
	useSafeAreaInsets,
} from "../utils/safe-area";

const meta = {
	title: "Foundations/Safe area",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const IPHONE: SafeAreaInsets = { top: 62, bottom: 34, left: 0, right: 0 };

const utilities = [
	["pt-safe / pb-safe", "Padding equal to the top or bottom inset"],
	["px-safe / py-safe", "Both horizontal or both vertical insets"],
	["pb-safe-offset-4", "Spacing step 4 (16px) plus the bottom inset"],
	["top-safe / bottom-safe", "Positions offset by the inset"],
] as const;

const InsetReadout = () => {
	const insets = useSafeAreaInsets();
	return (
		<dl class="grid grid-cols-4 gap-2 text-sm">
			<For each={["top", "bottom", "left", "right"] as const}>
				{(side) => (
					<div class="rounded-control bg-secondary p-2">
						<dt class="text-xs text-muted-foreground">{side}</dt>
						<dd class="m-0 font-semibold tabular-nums">{insets()[side]}px</dd>
					</div>
				)}
			</For>
		</dl>
	);
};

const Tabs = () => {
	const [value, setValue] = createSignal("home");
	return (
		<TabBar
			value={value()}
			onChange={setValue}
			items={[
				{ value: "home", label: "Home", icon: <HomeSmileIcon /> },
				{ value: "settings", label: "Settings", icon: <SettingsIcon /> },
			]}
		/>
	);
};

export const Overview: Story = {
	render: () => (
		<div class="-m-6 flex min-h-dvh flex-col bg-background text-foreground">
			<NavHeader title="Safe area" safeTop />
			<div class="flex flex-col gap-4 px-safe-offset-4 pb-32">
				<p class="m-0 text-sm text-muted-foreground">
					Pick a preset from the Safe area toolbar menu. The hatched regions
					show the unsafe areas.
				</p>
				<InsetReadout />
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					<For each={utilities}>
						{([name, description]) => (
							<li class="flex flex-col rounded-control bg-secondary px-3 py-2">
								<code class="text-sm font-semibold">{name}</code>
								<span class="text-xs text-muted-foreground">{description}</span>
							</li>
						)}
					</For>
				</ul>
				<Drawer>
					<DrawerTrigger as={Button} variant="secondary">
						Open drawer
					</DrawerTrigger>
					<DrawerContent title="Drawer">
						<p class="m-0 text-sm text-muted-foreground">
							The bottom padding is 16px plus the bottom inset.
						</p>
					</DrawerContent>
				</Drawer>
			</div>
			<Tabs />
		</div>
	),
};

const WithInsets = (props: { insets: SafeAreaInsets | null }) => {
	onMount(() => applySafeAreaInsets(props.insets));
	onCleanup(() => applySafeAreaInsets(null));
	return (
		<div class="-m-6 flex min-h-dvh flex-col bg-background text-foreground">
			<Drawer initialOpen>
				<DrawerTrigger as={Button} variant="secondary">
					Open drawer
				</DrawerTrigger>
				<DrawerContent title="Drawer">
					<p class="m-0 text-sm">Content</p>
				</DrawerContent>
			</Drawer>
			<Tabs />
		</div>
	);
};

const paddingBottom = (element: Element | null) =>
	element ? Number.parseFloat(getComputedStyle(element).paddingBottom) : NaN;

const tabBarContainer = (canvasElement: HTMLElement) =>
	canvasElement.ownerDocument.querySelector("[data-tab-bar-container]");

export const InjectedInsets: Story = {
	render: () => <WithInsets insets={IPHONE} />,
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(readSafeAreaInsets()).toEqual(IPHONE));
		await expect(paddingBottom(tabBarContainer(canvasElement))).toBe(8 + 34);
		const dialog = await screen.findByRole("dialog");
		await expect(
			paddingBottom(dialog.querySelector("[data-drawer-scroll]")),
		).toBe(16 + 34);
	},
};

export const NoInsets: Story = {
	render: () => <WithInsets insets={null} />,
	play: async ({ canvasElement }) => {
		await expect(readSafeAreaInsets()).toEqual({
			top: 0,
			bottom: 0,
			left: 0,
			right: 0,
		});
		await expect(paddingBottom(tabBarContainer(canvasElement))).toBe(8);
		const dialog = await screen.findByRole("dialog");
		await expect(
			paddingBottom(dialog.querySelector("[data-drawer-scroll]")),
		).toBe(16);
		await expect(
			within(canvasElement).getByRole("navigation", { name: "Main" }),
		).toBeVisible();
	},
};

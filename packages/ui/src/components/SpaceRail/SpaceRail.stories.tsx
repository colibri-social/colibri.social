import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { SpaceRailSkeleton } from "../Channels/ChannelSkeletons";
import {
	SPACE_RAIL_FILLET,
	SPACE_RAIL_METRICS,
	SpaceRail,
	SpaceRailAction,
	SpaceRailItem,
	type SpaceRailPlatform,
	spaceRailPanelClass,
} from "./SpaceRail";

const meta = {
	title: "Navigation/Space rail",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type RailSpace = {
	id: string;
	name: string;
	iconSrc?: string;
	unread?: boolean;
	mentions?: number;
};

const spaces: RailSpace[] = [
	{
		id: "flock",
		name: "Colibri Social Flock",
		iconSrc: storyImages.violetIcon(),
	},
	{
		id: "birds",
		name: "Bird watchers",
		iconSrc: storyImages.tealIcon(),
		mentions: 3,
	},
	{
		id: "canal",
		name: "Canal walks",
		iconSrc: storyImages.amberIcon(),
		unread: true,
	},
	{ id: "atproto", name: "AT Protocol devs" },
];

const onSelect = fn();
const onCreate = fn();
const onDiscover = fn();

const Rail = (props: {
	platform?: SpaceRailPlatform;
	initial?: string;
	panel?: boolean;
}) => {
	const [active, setActive] = createSignal(props.initial ?? "flock");
	return (
		<div class="flex h-dvh bg-background">
			<SpaceRail
				platform={props.platform}
				leading={
					props.platform === "desktop" ? (
						<SpaceRailAction
							label="Inbox"
							icon={<InboxIcon />}
							onClick={() => {}}
						/>
					) : undefined
				}
				onCreate={onCreate}
				onDiscover={onDiscover}
			>
				<For each={spaces}>
					{(space) => (
						<SpaceRailItem
							name={space.name}
							iconSrc={space.iconSrc}
							unread={space.unread}
							mentions={space.mentions}
							active={active() === space.id}
							onSelect={() => {
								setActive(space.id);
								onSelect(space.id);
							}}
						/>
					)}
				</For>
			</SpaceRail>
			<Show when={props.panel}>
				<div
					data-rail-panel=""
					class={`${spaceRailPanelClass} min-w-0 flex-1 bg-card`}
				/>
			</Show>
		</div>
	);
};

const rectOf = (element: Element | null) =>
	(element as HTMLElement).getBoundingClientRect();

const near = (actual: number, expected: number) =>
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

export const States: Story = {
	render: () => <Rail />,
	play: async ({ canvasElement }) => {
		onSelect.mockClear();
		const canvas = within(canvasElement);
		const active = canvas.getByRole("button", { name: "Colibri Social Flock" });
		await expect(active).toHaveAttribute("aria-current", "page");

		const mentioned = canvas.getByRole("button", {
			name: "Bird watchers, 3 mentions",
		});
		const badge = canvasElement.querySelector("[data-rail-mentions]");
		await expect(badge).toHaveTextContent("3");

		const unread = canvas.getByRole("button", { name: "Canal walks, unread" });
		const unreadItem = unread.closest("[data-rail-item]") as HTMLElement;
		const unreadPill = unreadItem.querySelector(
			"[data-rail-pill]",
		) as HTMLElement;
		await expect(unreadPill.style.height).toBe("8px");

		await userEvent.click(mentioned);
		await expect(onSelect).toHaveBeenCalledTimes(1);
		await expect(onSelect).toHaveBeenCalledWith("birds");
		await expect(mentioned).toHaveAttribute("aria-current", "page");
		await expect(active).not.toHaveAttribute("aria-current");
		const pill = mentioned
			.closest("[data-rail-item]")
			?.querySelector("[data-rail-pill]") as HTMLElement;
		await expect(pill.style.height).toBe("0px");
		const tab = canvasElement.querySelector("[data-rail-tab]");
		const item = mentioned.closest("[data-rail-item]");
		await waitFor(() => near(rectOf(tab).top, rectOf(item).top - 2));
	},
};

const measureFigma = async (
	canvasElement: HTMLElement,
	platform: SpaceRailPlatform,
) => {
	const metrics = SPACE_RAIL_METRICS[platform];
	const rail = rectOf(canvasElement.querySelector("[data-space-rail]"));
	near(rail.width, metrics.width);
	const items = Array.from(
		canvasElement.querySelectorAll<HTMLElement>("[data-rail-item]"),
	);
	const icons = items.map((item) =>
		rectOf(item.querySelector("[data-rail-focusable]")),
	);
	for (const icon of icons) {
		near(icon.left - rail.left, 8);
		near(icon.width, metrics.icon);
		near(icon.height, metrics.icon);
	}
	for (let index = 1; index < icons.length; index++) {
		const previous = icons[index - 1] as DOMRect;
		const current = icons[index] as DOMRect;
		near(current.top - previous.bottom, metrics.gap);
	}
	const tab = canvasElement.querySelector("[data-rail-tab]") as HTMLElement;
	const activeIcon = icons[0] as DOMRect;
	await waitFor(() => near(rectOf(tab).top, activeIcon.top - metrics.tabRing));
	const tabRect = rectOf(tab);
	near(tabRect.left - rail.left, metrics.tabLeft);
	near(tabRect.right, rail.right);
	near(tabRect.height, metrics.icon + metrics.tabRing * 2);
	const bottomFillet = rectOf(
		tab.querySelector('[data-rail-tab-fillet="bottom"]'),
	);
	near(bottomFillet.width, SPACE_RAIL_FILLET);
	near(bottomFillet.right, rail.right);
	near(bottomFillet.top, tabRect.bottom);
	const topFillet = rectOf(tab.querySelector('[data-rail-tab-fillet="top"]'));
	near(topFillet.bottom, tabRect.top);
	return { rail, tab, tabRect, activeIcon };
};

export const FigmaMobile: Story = {
	render: () => <Rail panel />,
	play: async ({ canvasElement }) => {
		const { rail, tab, tabRect, activeIcon } = await measureFigma(
			canvasElement,
			"mobile",
		);
		near(activeIcon.top - rail.top, 2);
		near(tabRect.top, rail.top);
		const corner = rectOf(tab.querySelector("[data-rail-tab-corner]"));
		near(corner.left, rail.right);
		near(corner.top, rail.top);
		near(corner.width, 16);
		const panel = canvasElement.querySelector(
			"[data-rail-panel]",
		) as HTMLElement;
		await expect(getComputedStyle(panel).borderTopLeftRadius).toBe("16px");
		near(rectOf(panel).left, rail.right);
		const actions = Array.from(
			canvasElement.querySelectorAll("[data-rail-action] button"),
		).map(rectOf);
		for (const action of actions) {
			near(action.width, 48);
			near(action.left - rail.left, 8);
		}
	},
};

export const FigmaDesktop: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <Rail platform="desktop" panel />,
	play: async ({ canvasElement }) => {
		const { rail, activeIcon } = await measureFigma(canvasElement, "desktop");
		const separator = rectOf(
			canvasElement.querySelector("[data-rail-separator]"),
		);
		near(separator.top - rail.top, 48);
		near(separator.width, 40);
		near(activeIcon.top - rail.top, 57);
		const inner = rectOf(
			canvasElement.querySelector(
				'[data-rail-item][data-state="active"] [data-rail-icon]',
			),
		);
		await waitFor(() => near(inner.width, 36));
		await expect(
			canvasElement.querySelector("[data-rail-tab-corner]"),
		).toBeNull();
	},
};

export const KeyboardNavigation: Story = {
	render: () => <Rail />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = canvas.getByRole("button", { name: "Colibri Social Flock" });
		await expect(first).toHaveAttribute("tabindex", "0");
		first.focus();
		await userEvent.keyboard("{ArrowDown}");
		await expect(
			canvas.getByRole("button", { name: "Bird watchers, 3 mentions" }),
		).toHaveFocus();
		await userEvent.keyboard("{End}");
		await expect(
			canvas.getByRole("button", { name: "Discover Spaces" }),
		).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(onDiscover).toHaveBeenCalled());
	},
};

export const Skeleton: Story = {
	render: () => (
		<div class="flex h-dvh gap-4 bg-background">
			<SpaceRailSkeleton />
			<Rail />
		</div>
	),
	play: async ({ canvasElement }) => {
		const skeleton = canvasElement.querySelector(
			"[data-space-rail-skeleton]",
		) as HTMLElement;
		const rail = canvasElement.querySelector(
			"[data-space-rail]",
		) as HTMLElement;
		const s = skeleton.getBoundingClientRect();
		const r = rail.getBoundingClientRect();
		await expect(Math.abs(s.width - r.width)).toBeLessThanOrEqual(1);
		const firstSkeleton = skeleton.firstElementChild as HTMLElement;
		const firstItem = rail.querySelector("[data-rail-item]") as HTMLElement;
		await expect(
			Math.abs(
				firstSkeleton.getBoundingClientRect().height -
					firstItem.getBoundingClientRect().height,
			),
		).toBeLessThanOrEqual(1);
	},
};

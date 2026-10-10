import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CountBadge } from "../Badge/Badge";
import { storyImages } from "../Banner/story-images";
import { SpaceRailSkeleton } from "../Channels/ChannelSkeletons";
import { TOOLTIP_OPEN_DELAY } from "../Tooltip/Tooltip";
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
					<SpaceRailAction
						label="Inbox"
						icon={<InboxIcon />}
						onClick={() => {}}
					/>
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
			<Show when={props.panel !== false}>
				<div
					data-rail-panel=""
					class={`${spaceRailPanelClass} min-w-0 flex-1`}
				/>
			</Show>
		</div>
	);
};

const rectOf = (element: Element | null) =>
	(element as HTMLElement).getBoundingClientRect();

const near = (actual: number, expected: number) =>
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

const expectTabStaysJoined = async (canvasElement: HTMLElement) => {
	const rail = rectOf(canvasElement.querySelector("[data-space-rail]"));
	const panel = canvasElement.querySelector(
		"[data-rail-panel]",
	) as HTMLElement | null;
	const parts = Array.from(
		canvasElement.querySelectorAll<HTMLElement>("[data-rail-tab] > *"),
	)
		.map((part) => part.getBoundingClientRect())
		.filter((part) => part.width > 0 && part.height > 0);
	const overhanging = parts.filter((part) => part.right > rail.right + 1);
	if (overhanging.length === 0) return;
	await expect(panel).not.toBeNull();
	if (!panel) return;
	await expect(getComputedStyle(panel).position).not.toBe("static");
	const panelRect = panel.getBoundingClientRect();
	near(panelRect.left, rail.right);
	const radius = Number.parseFloat(getComputedStyle(panel).borderTopLeftRadius);
	for (const part of overhanging) {
		near(part.left, panelRect.left);
		await expect(part.right).toBeLessThanOrEqual(panelRect.left + radius + 1);
	}
};

const expectGrayBorderWithPrimaryJoin = async (canvasElement: HTMLElement) => {
	const panel = canvasElement.querySelector("[data-rail-panel]") as HTMLElement;
	const probe = document.createElement("span");
	probe.style.color = "var(--muted)";
	canvasElement.append(probe);
	const muted = getComputedStyle(probe).color;
	probe.remove();
	await expect(getComputedStyle(panel).borderLeftColor).toBe(muted);
	await expect(getComputedStyle(panel).borderTopColor).toBe(muted);
	const tabElement = canvasElement.querySelector(
		"[data-rail-tab]",
	) as HTMLElement;
	await waitFor(() => {
		const panelRect = panel.getBoundingClientRect();
		const tab = tabElement.getBoundingClientRect();
		const topFillet = rectOf(
			tabElement.querySelector('[data-rail-tab-fillet="top"]'),
		);
		const bottomFillet = rectOf(
			tabElement.querySelector('[data-rail-tab-fillet="bottom"]'),
		);
		const join = getComputedStyle(panel, "::before");
		const offset = new DOMMatrixReadOnly(join.transform).m42;
		const borderTop = Number.parseFloat(getComputedStyle(panel).borderTopWidth);
		const joinTop =
			panelRect.top + borderTop + Number.parseFloat(join.top) + offset;
		const joinBottom = joinTop + Number.parseFloat(join.height);
		const atTop = tab.top - panelRect.top < 0.5;
		near(joinTop, atTop ? tab.top : topFillet.top);
		near(joinBottom, bottomFillet.bottom);
		expect(join.backgroundImage).toContain("linear-gradient");
		expect(join.opacity).toBe("1");
		expect(Number.parseFloat(join.width)).toBe(1);
	});
};

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
		await expectTabStaysJoined(canvasElement);
		await expectGrayBorderWithPrimaryJoin(canvasElement);
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
		await expectTabStaysJoined(canvasElement);
		await expectGrayBorderWithPrimaryJoin(canvasElement);
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
	render: () => <Rail />,
	play: async ({ canvasElement }) => {
		const { rail, tabRect, activeIcon } = await measureFigma(
			canvasElement,
			"mobile",
		);
		const separator = rectOf(
			canvasElement.querySelector("[data-rail-separator]"),
		);
		near(separator.width, 48);
		await expect(tabRect.top).toBeGreaterThan(separator.bottom);
		near(activeIcon.top - tabRect.top, 2);
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
	render: () => <Rail platform="desktop" />,
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

const skeletonMatchesRail = async (canvasElement: HTMLElement) => {
	const skeleton = canvasElement.querySelector(
		"[data-space-rail-skeleton]",
	) as HTMLElement;
	const rail = canvasElement.querySelector("[data-space-rail]") as HTMLElement;
	const s = skeleton.getBoundingClientRect();
	const r = rail.getBoundingClientRect();
	await expect(Math.abs(s.width - r.width)).toBeLessThanOrEqual(1);
	await expect(Math.abs(s.top - r.top)).toBeLessThanOrEqual(1);
	const offsets = (root: HTMLElement, selector: string) =>
		Array.from(root.querySelectorAll<HTMLElement>(selector), (element) => {
			const box = element.getBoundingClientRect();
			return {
				top: box.top - root.getBoundingClientRect().top,
				height: box.height,
				width: box.width,
			};
		});
	const pairs: [string, string][] = [
		["[data-rail-skeleton-leading]", "[data-rail-action]"],
		["[data-rail-skeleton-separator]", "[data-rail-separator]"],
		["[data-rail-skeleton-item]", "[data-rail-item]"],
	];
	for (const [placeholder, loaded] of pairs) {
		const ghosts = offsets(skeleton, placeholder);
		const reals = offsets(rail, loaded);
		await expect(ghosts.length).toBeGreaterThan(0);
		for (const [index, ghost] of ghosts.slice(0, reals.length).entries()) {
			const real = reals[index];
			await expect(Math.abs(ghost.top - real.top)).toBeLessThanOrEqual(0.5);
			await expect(Math.abs(ghost.height - real.height)).toBeLessThanOrEqual(
				0.5,
			);
		}
	}
	const separator = offsets(skeleton, "[data-rail-skeleton-separator]")[0];
	const realSeparator = offsets(rail, "[data-rail-separator]")[0];
	await expect(Math.abs(separator.width - realSeparator.width)).toBeLessThan(
		0.5,
	);
};

export const Skeleton: Story = {
	render: () => (
		<div class="flex h-dvh gap-4 bg-background">
			<SpaceRailSkeleton count={spaces.length} />
			<Rail panel={false} />
		</div>
	),
	play: async ({ canvasElement }) => skeletonMatchesRail(canvasElement),
};

export const DesktopSkeleton: Story = {
	parameters: { viewport: { defaultViewport: "reset" } },
	render: () => (
		<div class="flex h-dvh gap-4 bg-background">
			<SpaceRailSkeleton platform="desktop" count={spaces.length} />
			<Rail platform="desktop" panel={false} />
		</div>
	),
	play: async ({ canvasElement }) => skeletonMatchesRail(canvasElement),
};

type RailFrameSample = {
	panelTop: number | undefined;
	joinTop: number | undefined;
	joinBottom: number | undefined;
	bottom: number;
	top: number;
	height: number;
	visible: boolean;
	opacity: number;
	activeCount: number;
};

const sampleSwitch = async (
	canvasElement: HTMLElement,
	targetName: RegExp,
): Promise<RailFrameSample[]> => {
	const tab = canvasElement.querySelector("[data-rail-tab]") as HTMLElement;
	const panel = canvasElement.querySelector(
		"[data-rail-panel]",
	) as HTMLElement | null;
	const samples: RailFrameSample[] = [];
	let recording = true;
	const record = () => {
		const box = tab.getBoundingClientRect();
		const style = getComputedStyle(tab);
		let panelTop: number | undefined;
		let joinTop: number | undefined;
		let joinBottom: number | undefined;
		if (panel) {
			const panelBox = panel.getBoundingClientRect();
			panelTop = panelBox.top;
			const border = Number.parseFloat(getComputedStyle(panel).borderTopWidth);
			const join = getComputedStyle(panel, "::before");
			const offset = new DOMMatrixReadOnly(join.transform).m42;
			joinTop = panelBox.top + border + Number.parseFloat(join.top) + offset;
			joinBottom = joinTop + Number.parseFloat(join.height);
		}
		samples.push({
			panelTop,
			joinTop,
			joinBottom,
			bottom: box.bottom,
			top: box.top,
			height: box.height,
			visible: style.visibility === "visible",
			opacity: Number.parseFloat(style.opacity),
			activeCount: canvasElement.querySelectorAll('[aria-current="page"]')
				.length,
		});
		if (recording) requestAnimationFrame(record);
	};
	requestAnimationFrame(record);
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: targetName }),
	);
	await new Promise((resolve) => setTimeout(resolve, 700));
	recording = false;
	return samples;
};

const expectSmoothSwitch = async (samples: RailFrameSample[]) => {
	await expect(samples.length).toBeGreaterThan(10);
	const height = samples[0]?.height ?? 0;
	let direction = 0;
	for (let index = 0; index < samples.length; index++) {
		const sample = samples[index] as RailFrameSample;
		await expect(sample.visible).toBe(true);
		await expect(sample.opacity).toBe(1);
		await expect(Math.abs(sample.height - height)).toBeLessThanOrEqual(0.5);
		await expect(sample.activeCount).toBe(1);
		if (sample.joinTop !== undefined && sample.joinBottom !== undefined) {
			await expect(sample.joinTop).toBeGreaterThanOrEqual(
				sample.top - SPACE_RAIL_FILLET - 0.75,
			);
			await expect(sample.joinTop).toBeGreaterThanOrEqual(
				(sample.panelTop ?? 0) - 0.75,
			);
			await expect(sample.joinBottom).toBeLessThanOrEqual(
				sample.bottom + SPACE_RAIL_FILLET + 0.75,
			);
		}
		if (index === 0) continue;
		const delta = sample.top - (samples[index - 1] as RailFrameSample).top;
		if (Math.abs(delta) < 0.01) continue;
		const sign = Math.sign(delta);
		if (direction === 0) direction = sign;
		await expect(sign).toBe(direction);
	}
};

export const SwitchFromTopIsSmooth: Story = {
	render: () => <Rail />,
	play: async ({ canvasElement }) => {
		const toSecond = await sampleSwitch(canvasElement, /^Bird watchers/);
		await expectSmoothSwitch(toSecond);
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Colibri Social Flock",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 700));
		const toThird = await sampleSwitch(canvasElement, /^Canal walks/);
		await expectSmoothSwitch(toThird);
	},
};

export const SwitchFromTopIsSmoothDesktop: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => <Rail platform="desktop" />,
	play: async ({ canvasElement }) => {
		const toSecond = await sampleSwitch(canvasElement, /^Bird watchers/);
		await expectSmoothSwitch(toSecond);
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Colibri Social Flock",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 700));
		const toThird = await sampleSwitch(canvasElement, /^Canal walks/);
		await expectSmoothSwitch(toThird);
	},
};

const FLICKER_PROPERTIES = [
	"opacity",
	"visibility",
	"background-color",
	"box-shadow",
	"outline-color",
	"height",
] as const;

const recordFlicker = async (
	canvasElement: HTMLElement,
	targetName: RegExp,
) => {
	const root = canvasElement.querySelector("[data-space-rail]")
		?.parentElement as HTMLElement;
	const nodes = Array.from(root.querySelectorAll<HTMLElement>("*"));
	const pseudo = canvasElement.querySelector("[data-rail-panel]");
	const frames: string[][] = [];
	let recording = true;
	const snapshot = () => {
		const row = nodes.map((node) => {
			const style = getComputedStyle(node);
			return FLICKER_PROPERTIES.map((name) =>
				style.getPropertyValue(name),
			).join("|");
		});
		if (pseudo) {
			for (const which of ["::before", "::after"]) {
				const style = getComputedStyle(pseudo, which);
				row.push(`${which}:${style.opacity}|${style.height}|${style.top}`);
			}
		}
		frames.push(row);
		if (recording) requestAnimationFrame(snapshot);
	};
	requestAnimationFrame(snapshot);
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: targetName }),
	);
	await new Promise((resolve) => setTimeout(resolve, 700));
	recording = false;
	const offenders: string[] = [];
	const columns = frames[0]?.length ?? 0;
	for (let column = 0; column < columns; column++) {
		const values = frames.map((frame) => frame[column]);
		const distinct: string[] = [];
		for (const value of values) {
			if (distinct.at(-1) !== value) distinct.push(value as string);
		}
		const seen = new Set<string>();
		for (const value of distinct) {
			if (seen.has(value)) {
				const node = nodes[column];
				offenders.push(
					`${
						node
							? `${node.tagName}.${node
									.getAttributeNames()
									.filter((name) => name.startsWith("data-"))
									.join(",")}`
							: `pseudo${column}`
					}: ${distinct.join(" -> ")}`,
				);
				break;
			}
			seen.add(value);
		}
	}
	return offenders;
};

export const SwitchHasNoFlicker: Story = {
	render: () => <Rail />,
	play: async ({ canvasElement }) => {
		const toSecond = await recordFlicker(canvasElement, /^Bird watchers/);
		await expect(toSecond).toEqual([]);
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Colibri Social Flock",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 700));
		const toThird = await recordFlicker(canvasElement, /^Canal walks/);
		await expect(toThird).toEqual([]);
	},
};

export const SwitchHasNoFlickerDesktop: Story = {
	render: () => <Rail platform="desktop" />,
	play: async ({ canvasElement }) => {
		const toSecond = await recordFlicker(canvasElement, /^Bird watchers/);
		await expect(toSecond).toEqual([]);
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Colibri Social Flock",
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 700));
		const toThird = await recordFlicker(canvasElement, /^Canal walks/);
		await expect(toThird).toEqual([]);
	},
};

const ActionTrigger = () => {
	const [open, setOpen] = createSignal(false);
	const [unread, setUnread] = createSignal(12);
	return (
		<div class="flex h-dvh bg-background">
			<SpaceRail
				platform="desktop"
				leading={
					<SpaceRailAction
						label="Inbox"
						icon={<InboxIcon />}
						aria-haspopup="dialog"
						aria-expanded={open()}
						aria-controls={open() ? "rail-inbox-panel" : undefined}
						badge={
							<CountBadge
								count={unread()}
								class="shadow-[0_0_0_3px_var(--background)]"
							/>
						}
						badgeLabel={
							unread() > 0 ? `${unread()} unread` : "No unread notifications"
						}
						onClick={() => setOpen((value) => !value)}
					/>
				}
			>
				<For each={spaces}>
					{(space) => (
						<SpaceRailItem name={space.name} iconSrc={space.iconSrc} />
					)}
				</For>
			</SpaceRail>
			<div class={`${spaceRailPanelClass} min-w-0 flex-1 p-4`}>
				<Show when={open()}>
					<div id="rail-inbox-panel" role="dialog" aria-label="Inbox">
						<button type="button" onClick={() => setUnread(0)}>
							Clear unread
						</button>
					</div>
				</Show>
			</div>
		</div>
	);
};

export const ActionAsPopupTrigger: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => <ActionTrigger />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", { name: "Inbox" });
		await expect(button).toHaveAttribute("aria-haspopup", "dialog");
		await expect(button).toHaveAttribute("aria-expanded", "false");
		await expect(button).toHaveAccessibleDescription("12 unread");
		const badge = canvasElement.querySelector<HTMLElement>(
			"[data-rail-action-badge]",
		);
		await expect(badge).not.toBeNull();
		if (!badge) return;
		await expect(button.contains(badge)).toBe(false);
		await expect(badge).toHaveAttribute("aria-hidden", "true");
		const buttonBox = button.getBoundingClientRect();
		const badgeBox = badge.getBoundingClientRect();
		near(badgeBox.right, buttonBox.right + 4);
		near(badgeBox.bottom, buttonBox.bottom + 4);

		await userEvent.click(button);
		await expect(button).toHaveAttribute("aria-expanded", "true");
		await expect(button).toHaveAttribute("aria-controls", "rail-inbox-panel");
		await userEvent.hover(button);
		await new Promise((resolve) =>
			setTimeout(resolve, TOOLTIP_OPEN_DELAY + 200),
		);
		await expect(screen.queryByRole("tooltip")).toBeNull();

		await userEvent.click(canvas.getByRole("button", { name: "Clear unread" }));
		await expect(
			canvasElement.querySelector("[data-rail-action-badge] *"),
		).toBeNull();
		await expect(button).toHaveAccessibleDescription("No unread notifications");

		await userEvent.click(button);
		await expect(button).toHaveAttribute("aria-expanded", "false");
		await expect(button).not.toHaveAttribute("aria-controls");
		await userEvent.unhover(button);
		await userEvent.hover(button);
		await waitFor(
			() => expect(screen.getByRole("tooltip")).toHaveTextContent("Inbox"),
			{ timeout: 3000 },
		);
	},
};

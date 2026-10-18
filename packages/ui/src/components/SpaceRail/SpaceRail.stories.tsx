import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { createSignal, For, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CountBadge } from "../Badge/Badge";
import { storyImages } from "../Banner/story-images";
import { SpaceRailSkeleton } from "../Channels/ChannelSkeletons";
import { TOOLTIP_OPEN_DELAY } from "../Tooltip/Tooltip";
import {
	SPACE_RAIL_DESKTOP_FADE,
	SPACE_RAIL_FILLET,
	SPACE_RAIL_METRICS,
	SpaceRail,
	SpaceRailAction,
	SpaceRailItem,
	type SpaceRailPlatform,
	spaceRailMobilePanelClass,
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
	paddingTop?: number;
}) => {
	const [active, setActive] = createSignal(props.initial ?? "flock");
	return (
		<div class="flex h-dvh bg-background">
			<SpaceRail
				platform={props.platform}
				paddingTop={props.paddingTop}
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
					class={`${(props.platform ?? "mobile") === "mobile" ? spaceRailMobilePanelClass : spaceRailPanelClass} min-w-0 flex-1`}
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
		await expect(getComputedStyle(panel).borderTopLeftRadius).toBe("8px");
		near(rectOf(panel).left, rail.right);
		const first = rectOf(
			canvasElement.querySelector(
				"[data-rail-focusable], [data-rail-action] button",
			),
		);
		near(first.top - rectOf(panel).top, 18);
		const scroller = canvasElement.querySelector(
			"[data-rail-scroll]",
		) as HTMLElement;
		await expect(scroller.style.getPropertyValue("mask-image")).toBe("");
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

export const DesktopBottomFade: Story = {
	name: "Desktop bottom fade",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => (
		<div class="h-[240px] bg-background [&>div]:h-full">
			<Rail platform="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const scroller = canvasElement.querySelector(
			"[data-rail-scroll]",
		) as HTMLElement;
		const mask =
			scroller.style.getPropertyValue("mask-image") ||
			scroller.style.getPropertyValue("-webkit-mask-image");
		await expect(mask).toContain("in oklab");
		await expect(mask).toContain("transparent");
		const content = canvasElement.querySelector(
			"[data-rail-content]",
		) as HTMLElement;
		near(
			Number.parseFloat(getComputedStyle(content).paddingBottom),
			SPACE_RAIL_DESKTOP_FADE,
		);
		scroller.scrollTop = scroller.scrollHeight;
		await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
		const last = Array.from(
			canvasElement.querySelectorAll("[data-rail-action] button"),
		).map(rectOf);
		const final = last[last.length - 1];
		await expect(final).toBeDefined();
		await expect(
			rectOf(scroller).bottom - (final?.bottom ?? 0),
		).toBeGreaterThanOrEqual(SPACE_RAIL_DESKTOP_FADE - 0.5);
	},
};

export const DesktopTopInset: Story = {
	name: "Desktop top inset",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <Rail platform="desktop" paddingTop={8} />,
	play: async ({ canvasElement }) => {
		const rail = rectOf(canvasElement.querySelector("[data-space-rail]"));
		const inbox = rectOf(
			canvasElement.querySelector("[data-rail-action] button"),
		);
		near(inbox.top - rail.top, 8);
		const tab = canvasElement.querySelector("[data-rail-tab]") as HTMLElement;
		const active = rectOf(
			canvasElement.querySelector(
				'[data-rail-item][data-state="active"] [data-rail-focusable]',
			),
		);
		await waitFor(() => near(rectOf(tab).top, active.top));
		near(active.top - rail.top, 57 + 8);
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
	play: async ({ canvasElement }) => {
		await skeletonMatchesRail(canvasElement);
		const skeleton = canvasElement.querySelector(
			"[data-space-rail-skeleton]",
		) as HTMLElement;
		const scroller = canvasElement.querySelector(
			"[data-rail-scroll]",
		) as HTMLElement;
		const mask = getComputedStyle(skeleton).maskImage;
		await expect(mask).toContain("linear-gradient");
		await expect(mask).toBe(getComputedStyle(scroller).maskImage);
	},
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
	parameters: { viewport: { defaultViewport: "responsive" } },
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
	parameters: { viewport: { defaultViewport: "responsive" } },
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

const MenuRail = (props: {
	onMenu: (id: string) => void;
	onSelect: (id: string) => void;
}) => (
	<div class="h-[480px]">
		<SpaceRail>
			<For each={spaces}>
				{(space) => (
					<SpaceRailItem
						name={space.name}
						iconSrc={space.iconSrc}
						active={space.id === spaces[0]?.id}
						onSelect={() => props.onSelect(space.id)}
						onMenu={() => props.onMenu(space.id)}
					/>
				)}
			</For>
		</SpaceRail>
	</div>
);

let menuPointerSeed = 0;

const itemMenuArgs = { onMenu: fn(), onSelect: fn() };

export const ItemMenu: Story = {
	render: () => (
		<MenuRail onMenu={itemMenuArgs.onMenu} onSelect={itemMenuArgs.onSelect} />
	),
	play: async ({ canvasElement }) => {
		const { onMenu, onSelect } = itemMenuArgs;
		onMenu.mockClear();
		onSelect.mockClear();
		const second = spaces[1];
		if (!second) return;
		const button = within(canvasElement).getByRole("button", {
			name: new RegExp(second.name),
		});
		const box = button.getBoundingClientRect();
		const init = {
			bubbles: true,
			pointerType: "touch",
			pointerId: ++menuPointerSeed,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 2,
		};
		button.dispatchEvent(new PointerEvent("pointerdown", init));
		await new Promise((resolve) => setTimeout(resolve, 500));
		button.dispatchEvent(new PointerEvent("pointerup", init));
		button.click();
		await expect(onMenu).toHaveBeenCalledWith(second.id);
		await expect(onSelect).not.toHaveBeenCalled();

		onMenu.mockClear();
		button.dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
		);
		await expect(onMenu).toHaveBeenCalledWith(second.id);

		await userEvent.click(button);
		await expect(onSelect).toHaveBeenCalledWith(second.id);
	},
};

type Point = { x: number; y: number };

let reorderPointerSeed = 400;

const reorderPointer = (
	target: Element,
	type: string,
	point: Point,
	init: PointerEventInit = {},
) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			isPrimary: true,
			button: 0,
			buttons: type === "pointerup" ? 0 : 1,
			clientX: point.x,
			clientY: point.y,
			...init,
		}),
	);

const reorderTouchMove = (target: Element, point: Point) => {
	const touch = new Touch({
		identifier: 1,
		target,
		clientX: point.x,
		clientY: point.y,
	});
	const event = new TouchEvent("touchmove", {
		bubbles: true,
		cancelable: true,
		touches: [touch],
		changedTouches: [touch],
	});
	target.dispatchEvent(event);
	return event.defaultPrevented;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () =>
	new Promise((resolve) => requestAnimationFrame(resolve));

const centerOf = (element: Element): Point => {
	const rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const glideTo = async (
	target: Element,
	from: Point,
	to: Point,
	init: PointerEventInit,
	steps = 12,
) => {
	for (let step = 1; step <= steps; step++) {
		reorderPointer(
			target,
			"pointermove",
			{
				x: from.x + ((to.x - from.x) * step) / steps,
				y: from.y + ((to.y - from.y) * step) / steps,
			},
			init,
		);
		await nextFrame();
	}
};

const railItem = (root: HTMLElement, id: string) =>
	root.querySelector<HTMLElement>(`[data-rail-id="${id}"]`) as HTMLElement;

const railOrder = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-rail-id]")).map(
		(element) => element.dataset.railId,
	);

const overlay = () =>
	document.querySelector<HTMLElement>("[data-rail-reorder-overlay]");

const reorderSettled = async (root: HTMLElement) => {
	await waitFor(
		() => {
			expect(overlay()).toBeNull();
			expect(root.querySelector("[data-lifted]")).toBeNull();
			for (const element of root.querySelectorAll<HTMLElement>(
				"[data-rail-id]",
			))
				expect(element.style.transform).toBe("");
		},
		{ timeout: 3000 },
	);
};

type ReorderOutcome = "save" | "reject";

const reorderArgs = {
	onReorder: fn(),
	onMenu: fn(),
	onSelect: fn(),
	outcome: "save" as ReorderOutcome,
};

const resetReorderArgs = (outcome: ReorderOutcome = "save") => {
	reorderArgs.onReorder.mockClear();
	reorderArgs.onMenu.mockClear();
	reorderArgs.onSelect.mockClear();
	reorderArgs.outcome = outcome;
};

const manySpaces: RailSpace[] = [
	...spaces,
	...Array.from({ length: 10 }, (_, index) => ({
		id: `extra-${index + 1}`,
		name: `Space ${index + 1}`,
	})),
];

const ReorderRail = (props: {
	platform?: SpaceRailPlatform;
	list?: RailSpace[];
	height?: string;
	menu?: boolean;
}) => {
	const [order, setOrder] = createSignal(
		(props.list ?? spaces).map((space) => space.id),
	);
	const [active, setActive] = createSignal(order()[1] ?? "");
	const byId = new Map(
		(props.list ?? spaces).map((space) => [space.id, space]),
	);
	const ordered = () =>
		order()
			.map((id) => byId.get(id))
			.filter((space): space is RailSpace => !!space);
	return (
		<div
			class="flex bg-background"
			style={{ height: props.height ?? "100dvh" }}
		>
			<SpaceRail
				platform={props.platform}
				onReorder={(ids) => {
					reorderArgs.onReorder(ids);
					const previous = order();
					setOrder(ids);
					if (reorderArgs.outcome === "save") return Promise.resolve();
					return new Promise<void>((_, reject) =>
						setTimeout(() => {
							setOrder(previous);
							reject(new Error("rejected"));
						}, 50),
					);
				}}
			>
				<For each={ordered()}>
					{(space) => (
						<SpaceRailItem
							id={space.id}
							name={space.name}
							iconSrc={space.iconSrc}
							unread={space.unread}
							mentions={space.mentions}
							active={active() === space.id}
							onSelect={() => {
								setActive(space.id);
								reorderArgs.onSelect(space.id);
							}}
							onMenu={
								props.menu === false
									? undefined
									: () => reorderArgs.onMenu(space.id)
							}
						/>
					)}
				</For>
			</SpaceRail>
			<div
				data-rail-panel=""
				class={`${(props.platform ?? "mobile") === "mobile" ? spaceRailMobilePanelClass : spaceRailPanelClass} min-w-0 flex-1`}
			/>
		</div>
	);
};

const tabTop = (root: HTMLElement) =>
	(root.querySelector("[data-rail-tab]") as HTMLElement).getBoundingClientRect()
		.top;

export const ReorderDesktopDrag: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <ReorderRail platform="desktop" menu={false} />,
	play: async ({ canvasElement }) => {
		resetReorderArgs();
		const step =
			SPACE_RAIL_METRICS.desktop.icon + SPACE_RAIL_METRICS.desktop.gap;
		const flock = railItem(canvasElement, "flock");
		const canal = railItem(canvasElement, "canal");
		const birds = railItem(canvasElement, "birds");
		const init = { pointerType: "mouse", pointerId: ++reorderPointerSeed };
		const from = centerOf(flock);
		const birdsTopBefore = birds.getBoundingClientRect().top;
		const activeTabBefore = tabTop(canvasElement);
		reorderPointer(flock, "pointerdown", from, init);
		reorderPointer(flock, "pointermove", { x: from.x, y: from.y + 5 }, init);
		await nextFrame();
		await expect(overlay()).not.toBeNull();
		await expect(overlay()?.getAttribute("aria-hidden")).toBe("true");
		await expect(flock).toHaveAttribute("data-lifted");
		const to = { x: from.x + 4, y: centerOf(canal).y + 4 };
		await glideTo(flock, { x: from.x, y: from.y + 5 }, to, init);
		await waitFor(
			() =>
				expect(
					Math.round(birds.getBoundingClientRect().top - birdsTopBefore),
				).toBe(-step),
			{ timeout: 3000 },
		);
		await waitFor(() =>
			expect(Math.round(tabTop(canvasElement) - activeTabBefore)).toBe(-step),
		);
		await expect(reorderArgs.onReorder).not.toHaveBeenCalled();
		reorderPointer(flock, "pointerup", to, init);
		await reorderSettled(canvasElement);
		await expect(reorderArgs.onReorder).toHaveBeenCalledWith([
			"birds",
			"canal",
			"flock",
			"atproto",
		]);
		await expect(railOrder(canvasElement)).toEqual([
			"birds",
			"canal",
			"flock",
			"atproto",
		]);
		await expect(reorderArgs.onSelect).not.toHaveBeenCalled();
		await expect(
			canvasElement.querySelector('[role="status"]')?.textContent,
		).toContain("Moved Colibri Social Flock to position 3 of 4");
		await expectTabStaysJoined(canvasElement);
		const activeButton = within(canvasElement).getByRole("button", {
			name: /Bird watchers/,
		});
		near(
			tabTop(canvasElement) + SPACE_RAIL_METRICS.desktop.tabRing,
			activeButton.getBoundingClientRect().top,
		);
	},
};

export const ReorderTouchHold: Story = {
	render: () => <ReorderRail />,
	play: async ({ canvasElement }) => {
		resetReorderArgs();
		const flock = railItem(canvasElement, "flock");
		const atproto = railItem(canvasElement, "atproto");
		const start = centerOf(flock);

		const scroll = { pointerType: "touch", pointerId: ++reorderPointerSeed };
		reorderPointer(flock, "pointerdown", start, scroll);
		const prevented: boolean[] = [];
		for (let step = 1; step <= 4; step++) {
			const point = { x: start.x, y: start.y + step * 12 };
			reorderPointer(flock, "pointermove", point, scroll);
			prevented.push(reorderTouchMove(flock, point));
			await pause(16);
		}
		await pause(500);
		await expect(prevented).toEqual([false, false, false, false]);
		await expect(overlay()).toBeNull();
		reorderPointer(flock, "pointerup", start, scroll);

		const swipe = { pointerType: "touch", pointerId: ++reorderPointerSeed };
		reorderPointer(flock, "pointerdown", start, swipe);
		await glideTo(flock, start, { x: start.x + 80, y: start.y }, swipe, 4);
		await pause(450);
		await expect(overlay()).toBeNull();
		reorderPointer(flock, "pointerup", start, swipe);

		const hold = { pointerType: "touch", pointerId: ++reorderPointerSeed };
		reorderPointer(flock, "pointerdown", start, hold);
		await pause(250);
		await expect(overlay()).toBeNull();
		await pause(250);
		await expect(overlay()).not.toBeNull();
		await expect(reorderTouchMove(flock, start)).toBe(true);
		await expect(document.documentElement.style.userSelect).toBe("none");
		const slow = { x: start.x, y: centerOf(atproto).y + 4 };
		await glideTo(flock, start, slow, hold, 40);
		reorderPointer(flock, "pointerup", slow, hold);
		flock.querySelector<HTMLElement>("[data-rail-focusable]")?.click();
		await reorderSettled(canvasElement);
		await expect(document.documentElement.style.userSelect).toBe("");
		await expect(reorderArgs.onReorder).toHaveBeenCalledWith([
			"birds",
			"canal",
			"atproto",
			"flock",
		]);
		await expect(reorderArgs.onMenu).not.toHaveBeenCalled();
		await expect(reorderArgs.onSelect).not.toHaveBeenCalled();
	},
};

export const ReorderHoldOpensMenu: Story = {
	render: () => <ReorderRail />,
	play: async ({ canvasElement }) => {
		resetReorderArgs();
		const canal = railItem(canvasElement, "canal");
		const start = centerOf(canal);
		const hold = { pointerType: "touch", pointerId: ++reorderPointerSeed };
		reorderPointer(canal, "pointerdown", start, hold);
		await pause(500);
		await expect(overlay()).not.toBeNull();
		const jitter = { x: start.x + 2, y: start.y + 2 };
		reorderPointer(canal, "pointermove", jitter, hold);
		reorderPointer(canal, "pointerup", jitter, hold);
		canal.querySelector<HTMLElement>("[data-rail-focusable]")?.click();
		await reorderSettled(canvasElement);
		await expect(reorderArgs.onMenu).toHaveBeenCalledWith("canal");
		await expect(reorderArgs.onMenu).toHaveBeenCalledTimes(1);
		await expect(reorderArgs.onReorder).not.toHaveBeenCalled();
		await expect(reorderArgs.onSelect).not.toHaveBeenCalled();
		await expect(railOrder(canvasElement)).toEqual([
			"flock",
			"birds",
			"canal",
			"atproto",
		]);

		await userEvent.click(
			canal.querySelector<HTMLElement>("[data-rail-focusable]") as HTMLElement,
		);
		await expect(reorderArgs.onSelect).toHaveBeenCalledWith("canal");
	},
};

export const ReorderDragOutsideCancels: Story = {
	render: () => <ReorderRail />,
	play: async ({ canvasElement }) => {
		resetReorderArgs();
		const flock = railItem(canvasElement, "flock");
		const canal = railItem(canvasElement, "canal");
		const start = centerOf(flock);
		const hold = { pointerType: "touch", pointerId: ++reorderPointerSeed };
		reorderPointer(flock, "pointerdown", start, hold);
		await pause(500);
		const below = { x: start.x, y: centerOf(canal).y };
		await glideTo(flock, start, below, hold);
		const away = { x: start.x + 220, y: below.y };
		await glideTo(flock, below, away, hold, 6);
		await waitFor(() =>
			expect(railItem(canvasElement, "birds").style.transform).toBe(""),
		);
		reorderPointer(flock, "pointerup", away, hold);
		await reorderSettled(canvasElement);
		await expect(reorderArgs.onReorder).not.toHaveBeenCalled();
		await expect(reorderArgs.onMenu).not.toHaveBeenCalled();
		await expect(
			canvasElement.querySelector('[role="status"]')?.textContent,
		).toContain("Reorder cancelled");
	},
};

export const ReorderKeyboard: Story = {
	render: () => <ReorderRail />,
	play: async ({ canvasElement }) => {
		resetReorderArgs();
		const canvas = within(canvasElement);
		const birds = canvas.getByRole("button", { name: /Bird watchers/ });
		await expect(birds).toHaveAttribute(
			"aria-keyshortcuts",
			"Alt+ArrowUp Alt+ArrowDown",
		);
		const instructions = document.getElementById(
			birds.getAttribute("aria-describedby") ?? "",
		);
		await expect(instructions?.textContent).toContain("arrow key");
		birds.focus();
		await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
		await expect(reorderArgs.onReorder).toHaveBeenLastCalledWith([
			"flock",
			"canal",
			"birds",
			"atproto",
		]);
		await waitFor(() => expect(birds).toHaveFocus());
		await expect(
			canvasElement.querySelector('[role="status"]')?.textContent,
		).toContain("Moved Bird watchers to position 3 of 4");
		await userEvent.keyboard("{Alt>}{Home}{/Alt}");
		await expect(reorderArgs.onReorder).toHaveBeenLastCalledWith([
			"birds",
			"flock",
			"canal",
			"atproto",
		]);
		await waitFor(() => expect(birds).toHaveFocus());
		await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
		await expect(reorderArgs.onReorder).toHaveBeenCalledTimes(2);
		await userEvent.keyboard("{ArrowDown}");
		await expect(
			canvas.getByRole("button", { name: "Colibri Social Flock" }),
		).toHaveFocus();
		await expect(reorderArgs.onReorder).toHaveBeenCalledTimes(2);
		await reorderSettled(canvasElement);
	},
};

export const ReorderRevertsOnReject: Story = {
	render: () => <ReorderRail />,
	play: async ({ canvasElement }) => {
		resetReorderArgs("reject");
		const canvas = within(canvasElement);
		const flock = canvas.getByRole("button", { name: "Colibri Social Flock" });
		flock.focus();
		await userEvent.keyboard("{Alt>}{End}{/Alt}");
		await expect(reorderArgs.onReorder).toHaveBeenCalledWith([
			"birds",
			"canal",
			"atproto",
			"flock",
		]);
		await waitFor(
			() =>
				expect(railOrder(canvasElement)).toEqual([
					"flock",
					"birds",
					"canal",
					"atproto",
				]),
			{ timeout: 3000 },
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[role="status"]')?.textContent,
			).toContain("Couldn't move Colibri Social Flock"),
		);
		await reorderSettled(canvasElement);
	},
};

export const ReorderAutoscroll: Story = {
	render: () => <ReorderRail list={manySpaces} height="360px" />,
	play: async ({ canvasElement }) => {
		resetReorderArgs();
		const scroller = canvasElement.querySelector(
			"[data-rail-scroll]",
		) as HTMLElement;
		await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
		const flock = railItem(canvasElement, "flock");
		const start = centerOf(flock);
		const hold = { pointerType: "touch", pointerId: ++reorderPointerSeed };
		reorderPointer(flock, "pointerdown", start, hold);
		await pause(500);
		const bottom = scroller.getBoundingClientRect().bottom - 4;
		const edge = { x: start.x, y: bottom };
		await glideTo(flock, start, edge, hold);
		await waitFor(
			() =>
				expect(scroller.scrollTop).toBeGreaterThanOrEqual(
					scroller.scrollHeight - scroller.clientHeight - 1,
				),
			{ timeout: 4000 },
		);
		reorderPointer(flock, "pointermove", { x: edge.x, y: edge.y - 1 }, hold);
		reorderPointer(flock, "pointerup", { x: edge.x, y: edge.y - 1 }, hold);
		await reorderSettled(canvasElement);
		const saved = reorderArgs.onReorder.mock.calls.at(-1)?.[0] as string[];
		await expect(saved.at(-1)).toBe("flock");
	},
};

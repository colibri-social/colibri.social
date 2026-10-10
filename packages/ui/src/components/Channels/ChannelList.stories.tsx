import { SortVerticalIcon } from "@solar-icons/solid/bold/sort-vertical";
import { createSignal, type JSX, Show } from "solid-js";
import { expect, fn, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { IconButton } from "../IconButton/IconButton";
import type { VoiceParticipant } from "../Voice/shared";
import { ChannelList, type ChannelListCategory } from "./ChannelList";
import { ChannelListHeader } from "./ChannelListHeader";
import { ChannelRow, VoiceChannelRow } from "./ChannelRow";
import type { ChannelLayout, ChannelReorder } from "./channel-layout";

type StoryChannel = {
	id: string;
	name: string;
	kind?: "voice";
	preview?: { author: string; text: string };
	unread?: boolean;
	mentions?: number;
	participants?: VoiceParticipant[];
};

type StoryArgs = {
	onReorder: (change: ChannelReorder) => unknown;
	onChannelLongPress: (channel: StoryChannel, event: PointerEvent) => void;
	onCategoryLongPress: (categoryId: string, event: PointerEvent) => void;
};

const meta: Meta<StoryArgs> = {
	title: "Navigation/Channel reorder",
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: {
		onReorder: fn(),
		onChannelLongPress: fn(),
		onCategoryLongPress: fn(),
	},
};

export default meta;
type Story = StoryObj<StoryArgs>;

const lis: VoiceParticipant = {
	id: "lis",
	name: "Lis",
	avatarSrc: storyImages.tealIcon(),
	muted: true,
};
const tim: VoiceParticipant = {
	id: "tim",
	name: "Tim",
	avatarSrc: storyImages.amberIcon(),
	speaking: true,
};

const channel = (
	id: string,
	name: string,
	extra: Partial<StoryChannel> = {},
): StoryChannel => ({ id, name, ...extra });

const initialSpace = () => ({
	uncategorized: [
		channel("rules", "Rules", {
			preview: { author: "Lou", text: "Be kind to the birds" },
		}),
	],
	categories: [
		{
			id: "hangout",
			name: "Hangout",
			channels: [
				channel("general", "General", {
					unread: true,
					preview: { author: "Lou", text: "Read this message, please!" },
				}),
				channel("photos", "Photos", {
					mentions: 2,
					preview: { author: "Tim", text: "Kingfisher on the canal" },
				}),
				channel("files", "File sharing", {
					preview: { author: "Lis", text: "Route map for Saturday" },
				}),
			],
		},
		{
			id: "voice",
			name: "Voice",
			channels: [
				channel("lounge", "Lounge", { kind: "voice", participants: [lis] }),
				channel("call", "Birdwatch call", {
					kind: "voice",
					participants: [lis, tim],
				}),
			],
		},
		{ id: "archive", name: "Archive", channels: [] },
		{
			id: "events",
			name: "Events",
			collapsed: true,
			channels: [
				channel("meetups", "Meetups", {
					preview: { author: "Lis", text: "Sunday at the lake" },
				}),
				channel("trips", "Trips", {
					preview: { author: "Tim", text: "Ferry times" },
				}),
			],
		},
		{
			id: "regions",
			name: "Regions",
			channels: [
				"North",
				"South",
				"East",
				"West",
				"Coast",
				"Highlands",
				"Islands",
				"Valleys",
			].map((name) =>
				channel(name.toLowerCase(), name, {
					preview: { author: "Lou", text: `Sightings in the ${name}` },
				}),
			),
		},
	] as (ChannelListCategory<StoryChannel> & { collapsed?: boolean })[],
});

type Space = ReturnType<typeof initialSpace>;

const applyLayout = (space: Space, layout: ChannelLayout): Space => {
	const all = new Map<string, StoryChannel>();
	for (const entry of space.uncategorized) all.set(entry.id, entry);
	for (const category of space.categories)
		for (const entry of category.channels) all.set(entry.id, entry);
	const pick = (ids: readonly string[]) =>
		ids.map((id) => all.get(id)).filter((entry) => entry !== undefined);
	const byId = new Map(space.categories.map((entry) => [entry.id, entry]));
	return {
		uncategorized: pick(layout.uncategorized),
		categories: layout.categories.map((entry) => ({
			...(byId.get(entry.id) as ChannelListCategory<StoryChannel>),
			channels: pick(entry.channels),
		})),
	};
};

const Playground = (props: {
	args: StoryArgs;
	platform: "mobile" | "desktop";
	canReorder?: boolean;
	reorderMode?: boolean;
	failSaves?: boolean;
	height?: string;
	withMenu?: boolean;
}) => {
	const [space, setSpace] = createSignal(initialSpace());
	const [mode, setMode] = createSignal(!!props.reorderMode);
	const [failing, setFailing] = createSignal(!!props.failSaves);
	const [active, setActive] = createSignal("general");
	const desktop = props.platform === "desktop";

	const onReorder = (change: ChannelReorder) => {
		props.args.onReorder(change);
		if (failing())
			return new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Save failed")), 300),
			);
		setSpace((current) => applyLayout(current, change.layout));
		return undefined;
	};

	const spaceHeader = (
		<ChannelListHeader
			platform="desktop"
			name="Colibri Social Flock"
			iconSrc={storyImages.violetIcon()}
			memberCount={99}
			ownerHandle="lou.gg"
			menu={{
				onInvite: () => {},
				onCreateChannel: () => {},
				onReorderChannels: () => setMode(true),
			}}
		/>
	);

	const toolbar = (
		<div class="flex items-center gap-2 px-3 py-2">
			<span class="min-w-0 flex-1 truncate text-base font-semibold">
				Colibri Social Flock
			</span>
			<Show when={props.failSaves !== undefined}>
				<label class="flex items-center gap-1 text-xs text-muted-foreground">
					<input
						type="checkbox"
						checked={failing()}
						onChange={(event) => setFailing(event.currentTarget.checked)}
					/>
					Fail saves
				</label>
			</Show>
			<Show when={props.canReorder !== false}>
				<IconButton
					label="Reorder channels"
					variant="ghost"
					icon={<SortVerticalIcon />}
					onClick={() => setMode((value) => !value)}
				/>
			</Show>
		</div>
	);

	return (
		<div
			class={
				desktop
					? "flex h-dvh bg-background"
					: "flex h-dvh flex-col bg-background"
			}
		>
			<div
				data-story-scroller=""
				style={{ height: props.height ?? "100dvh" }}
				class={
					desktop
						? "relative w-72 overflow-y-auto overscroll-contain border-0 border-r border-solid border-border bg-card"
						: "relative w-full overflow-y-auto overscroll-contain"
				}
			>
				{props.withMenu ? spaceHeader : toolbar}
				<ChannelList
					uncategorized={space().uncategorized}
					categories={space().categories}
					getId={(entry) => entry.id}
					channelName={(entry) => entry.name}
					canReorder={props.canReorder ?? true}
					reorderMode={mode()}
					onReorderModeChange={setMode}
					onReorder={onReorder}
					onChannelLongPress={props.args.onChannelLongPress}
					onCategoryLongPress={props.args.onCategoryLongPress}
					onCollapsedChange={(categoryId, collapsed) =>
						setSpace((current) => ({
							...current,
							categories: current.categories.map((entry) =>
								entry.id === categoryId ? { ...entry, collapsed } : entry,
							),
						}))
					}
					onCreateChannel={desktop ? () => {} : undefined}
					onOpenCategorySettings={desktop ? () => {} : undefined}
					emptyCategoryLabel="Drag channels here to fill this category."
					renderChannel={(entry): JSX.Element =>
						entry.kind === "voice" ? (
							<VoiceChannelRow
								name={entry.name}
								platform={props.platform}
								participants={entry.participants}
							/>
						) : (
							<ChannelRow
								name={entry.name}
								platform={props.platform}
								density={desktop ? "compact" : "default"}
								active={active() === entry.id}
								unread={entry.unread}
								mentions={entry.mentions}
								preview={desktop ? undefined : entry.preview}
								onClick={() => setActive(entry.id)}
							/>
						)
					}
				/>
			</div>
		</div>
	);
};

const desktop = {
	viewport: { defaultViewport: "reset" },
	layout: "fullscreen",
};

type Point = { x: number; y: number };

let pointerSeed = 40;

const hitTarget = (target: Element, point: Point) =>
	target.isConnected
		? target
		: (document.elementFromPoint(point.x, point.y) ?? document.body);

const pointer = (
	target: Element,
	type: string,
	point: Point,
	init: PointerEventInit = {},
) =>
	(type === "pointerdown" ? target : hitTarget(target, point)).dispatchEvent(
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

const touchMove = (target: Element, point: Point) => {
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const nodeOf = (root: HTMLElement, id: string) =>
	root.querySelector<HTMLElement>(`[data-channel-id="${id}"]`) as HTMLElement;

const centerOf = (element: Element): Point => {
	const rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const orderIn = (root: HTMLElement, categoryId: string | null) => {
	const container =
		categoryId === null
			? root.querySelector("[data-list-uncategorized]")
			: root.querySelector(`[data-list-category="${categoryId}"]`);
	return Array.from(
		container?.querySelectorAll<HTMLElement>("[data-channel-id]") ?? [],
	).map((element) => element.dataset.channelId);
};

const categoryOrder = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-list-category]")).map(
		(element) => element.dataset.listCategory,
	);

const settled = async (root: HTMLElement) => {
	await waitFor(
		() => {
			expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
			expect(root.querySelector("[data-placeholder]")).toBeNull();
		},
		{ timeout: 3000 },
	);
	await waitFor(
		() =>
			expect(
				Array.from(root.querySelectorAll<HTMLElement>("[data-list-node]")).some(
					(element) => element.getAnimations().length > 0,
				),
			).toBe(false),
		{ timeout: 3000 },
	);
};

const glide = async (
	target: Element,
	from: Point,
	to: Point,
	init: PointerEventInit,
	steps = 12,
) => {
	for (let step = 1; step <= steps; step++) {
		const point = {
			x: from.x + ((to.x - from.x) * step) / steps,
			y: from.y + ((to.y - from.y) * step) / steps,
		};
		pointer(target, "pointermove", point, init);
		await frame();
	}
};

const NUDGE = 5;

const mouseDrag = async (
	element: HTMLElement,
	to: Point,
	options: { release?: boolean } = {},
) => {
	const init = { pointerType: "mouse", pointerId: ++pointerSeed };
	const from = centerOf(element);
	const lifted = { x: from.x, y: from.y + NUDGE };
	const end = { x: to.x, y: to.y + NUDGE };
	pointer(element, "pointerdown", from, init);
	pointer(element, "pointermove", lifted, init);
	await frame();
	await glide(element, lifted, end, init);
	if (options.release !== false) pointer(element, "pointerup", end, init);
	return init;
};

const lastChange = (args: StoryArgs) => {
	const calls = (args.onReorder as ReturnType<typeof fn>).mock.calls;
	return calls.at(-1)?.[0] as ChannelReorder | undefined;
};

export const DesktopDrag: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" />,
	play: async ({ canvasElement, args }) => {
		const general = nodeOf(canvasElement, "general");
		const photos = nodeOf(canvasElement, "photos");
		const files = nodeOf(canvasElement, "files");
		const slot =
			files.getBoundingClientRect().top - photos.getBoundingClientRect().top;
		const photosTop = photos.offsetTop;
		const target = { x: centerOf(files).x, y: centerOf(files).y + 12 };
		const init = await mouseDrag(general, target, { release: false });

		const overlay = document.querySelector<HTMLElement>(
			"[data-reorder-overlay]",
		);
		await expect(overlay).not.toBeNull();
		await expect(overlay?.getAttribute("aria-hidden")).toBe("true");
		await expect(general).toHaveAttribute("data-placeholder");
		await expect(getComputedStyle(general).opacity).toBe("0");
		await expect(orderIn(canvasElement, "hangout")).toEqual([
			"photos",
			"files",
			"general",
		]);
		await expect(photosTop - photos.offsetTop).toBeCloseTo(slot, 0);
		const overlayTop = () => overlay?.getBoundingClientRect().top ?? 0;
		const before = overlayTop();
		const held = { x: target.x, y: target.y + NUDGE };
		pointer(general, "pointermove", { x: held.x, y: held.y + 9 }, init);
		await expect(overlayTop() - before).toBeCloseTo(9, 1);
		pointer(general, "pointermove", held, init);
		await expect(overlayTop()).toBeCloseTo(before, 1);
		const generalBox = general.getBoundingClientRect();
		await expect(overlay?.getBoundingClientRect().width).toBeCloseTo(
			generalBox.width,
			0,
		);

		pointer(general, "pointerup", target, init);
		await settled(canvasElement);
		await expect(lastChange(args)).toMatchObject({
			type: "channel",
			id: "general",
			from: { categoryId: "hangout", index: 0 },
			to: { categoryId: "hangout", index: 2 },
		});
		await expect(orderIn(canvasElement, "hangout")).toEqual([
			"photos",
			"files",
			"general",
		]);
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="status"]')?.textContent).toBe(
				"Moved General to position 3 of 3 in Hangout.",
			),
		);
	},
};

export const DesktopAcrossCategories: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" />,
	play: async ({ canvasElement, args }) => {
		const archive = canvasElement.querySelector(
			'[data-list-category="archive"]',
		) as HTMLElement;
		const files = nodeOf(canvasElement, "files");
		const init = await mouseDrag(
			files,
			centerOf(
				archive.querySelector("[data-list-node='empty']") as HTMLElement,
			),
			{ release: false },
		);
		await waitFor(() =>
			expect(orderIn(canvasElement, "archive")).toEqual(["files"]),
		);
		await expect(archive.querySelector("[data-drop-zone]")).toBeNull();
		const placeholder = nodeOf(canvasElement, "files");
		await expect(placeholder.getBoundingClientRect().height).toBeGreaterThan(
			20,
		);
		pointer(placeholder, "pointerup", centerOf(placeholder), init);
		await settled(canvasElement);
		await expect(lastChange(args)).toMatchObject({
			to: { categoryId: "archive", index: 0 },
		});

		const events = canvasElement.querySelector(
			'[data-list-category="events"]',
		) as HTMLElement;
		const header = events.querySelector(
			"[data-category-header]",
		) as HTMLElement;
		await expect(events.querySelector("[data-category]")).toHaveAttribute(
			"data-collapsed",
		);
		const photos = nodeOf(canvasElement, "photos");
		const overHeader = { x: centerOf(header).x, y: centerOf(header).y + 12 };
		const springInit = await mouseDrag(photos, overHeader, {
			release: false,
		});
		await waitFor(() => expect(events).toHaveAttribute("data-drop-target"));
		await waitFor(
			() =>
				expect(events.querySelector("[data-category]")).not.toHaveAttribute(
					"data-collapsed",
				),
			{ timeout: 2000 },
		);
		const meetups = nodeOf(canvasElement, "meetups");
		await glide(
			photos,
			overHeader,
			{ x: centerOf(meetups).x, y: centerOf(meetups).y + 12 },
			springInit,
		);
		await waitFor(() =>
			expect(orderIn(canvasElement, "events")).toEqual([
				"meetups",
				"photos",
				"trips",
			]),
		);
		pointer(photos, "pointerup", centerOf(meetups), springInit);
		await settled(canvasElement);
		await expect(lastChange(args)).toMatchObject({
			id: "photos",
			to: { categoryId: "events", index: 1 },
		});
		await expect(events.querySelector("[data-category]")).not.toHaveAttribute(
			"data-collapsed",
		);

		const rules = nodeOf(canvasElement, "rules");
		const general = nodeOf(canvasElement, "general");
		const dragOut = await mouseDrag(
			general,
			{ x: centerOf(rules).x, y: centerOf(rules).y - 2 },
			{ release: false },
		);
		await waitFor(() =>
			expect(orderIn(canvasElement, null)).toEqual(["general", "rules"]),
		);
		const list = canvasElement.querySelector(
			"[data-channel-list]",
		) as HTMLElement;
		const outside = {
			x: list.getBoundingClientRect().right + 120,
			y: centerOf(rules).y,
		};
		await glide(general, centerOf(rules), outside, dragOut, 6);
		await waitFor(() =>
			expect(orderIn(canvasElement, null)).toEqual(["rules"]),
		);
		const calls = (args.onReorder as ReturnType<typeof fn>).mock.calls.length;
		pointer(general, "pointerup", outside, dragOut);
		await settled(canvasElement);
		await expect(
			(args.onReorder as ReturnType<typeof fn>).mock.calls.length,
		).toBe(calls);
		await expect(orderIn(canvasElement, "hangout")[0]).toBe("general");
	},
};

export const DesktopCategoryDrag: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" />,
	play: async ({ canvasElement, args }) => {
		const header = (id: string) =>
			canvasElement.querySelector(
				`[data-list-category="${id}"] [data-category-header]`,
			) as HTMLElement;
		const hangout = header("hangout");
		const init = { pointerType: "mouse", pointerId: ++pointerSeed };
		const from = centerOf(hangout);
		pointer(hangout, "pointerdown", from, init);
		await glide(hangout, from, { x: from.x, y: from.y + 6 }, init, 3);

		await waitFor(() =>
			expect(
				Array.from(canvasElement.querySelectorAll("[data-category]")).every(
					(section) => section.hasAttribute("data-collapsed"),
				),
			).toBe(true),
		);
		await expect(
			nodeOf(canvasElement, "general").checkVisibility({
				visibilityProperty: true,
			}),
		).toBe(false);
		await settledRows(canvasElement);
		const target = {
			x: centerOf(header("archive")).x,
			y: centerOf(header("archive")).y + 10,
		};
		await glide(hangout, { x: from.x, y: from.y + 6 }, target, init);
		await waitFor(() =>
			expect(categoryOrder(canvasElement)).toEqual([
				"voice",
				"archive",
				"hangout",
				"events",
				"regions",
			]),
		);
		pointer(hangout, "pointerup", target, init);
		await settled(canvasElement);
		await expect(lastChange(args)).toMatchObject({
			type: "category",
			id: "hangout",
			from: 0,
			to: 2,
		});
		await waitFor(() =>
			expect(
				nodeOf(canvasElement, "general").checkVisibility({
					visibilityProperty: true,
				}),
			).toBe(true),
		);
		await expect(
			canvasElement
				.querySelector('[data-list-category="events"] [data-category]')
				?.hasAttribute("data-collapsed"),
		).toBe(true);
	},
};

const settledRows = (root: HTMLElement) =>
	waitFor(
		() =>
			expect(
				Array.from(
					root.querySelectorAll<HTMLElement>("[data-category-header]"),
				).some((element) => element.getAnimations().length > 0),
			).toBe(false),
		{ timeout: 3000 },
	);

export const TouchHoldToDrag: Story = {
	render: (args) => <Playground args={args} platform="mobile" />,
	play: async ({ canvasElement, args }) => {
		const general = nodeOf(canvasElement, "general");
		const photos = nodeOf(canvasElement, "photos");
		const swipe = { pointerType: "touch", pointerId: ++pointerSeed };
		const start = centerOf(general);
		pointer(general, "pointerdown", start, swipe);
		const prevented: boolean[] = [];
		for (let step = 1; step <= 4; step++) {
			const point = { x: start.x, y: start.y - step * 12 };
			pointer(general, "pointermove", point, swipe);
			prevented.push(touchMove(general, point));
			await wait(16);
		}
		await wait(500);
		await expect(prevented).toEqual([false, false, false, false]);
		await expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
		pointer(general, "pointerup", start, swipe);
		await expect(args.onChannelLongPress).not.toHaveBeenCalled();

		const sideways = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(general, "pointerdown", start, sideways);
		await glide(general, start, { x: start.x + 80, y: start.y }, sideways, 4);
		await wait(450);
		await expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
		pointer(general, "pointerup", start, sideways);

		const hold = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(general, "pointerdown", start, hold);
		await wait(250);
		await expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
		await wait(250);
		await expect(
			document.querySelector("[data-reorder-overlay]"),
		).not.toBeNull();
		await expect(touchMove(general, start)).toBe(true);
		await expect(document.documentElement.style.userSelect).toBe("none");
		const target = { x: start.x, y: centerOf(photos).y + 8 };
		await glide(general, start, target, hold);
		await waitFor(() =>
			expect(orderIn(canvasElement, "hangout")).toEqual([
				"photos",
				"general",
				"files",
			]),
		);
		pointer(general, "pointerup", target, hold);
		await settled(canvasElement);
		await expect(document.documentElement.style.userSelect).toBe("");
		await expect(lastChange(args)).toMatchObject({
			id: "general",
			to: { categoryId: "hangout", index: 1 },
		});
		await expect(args.onChannelLongPress).not.toHaveBeenCalled();
	},
};

export const TouchHoldOpensMenu: Story = {
	render: (args) => <Playground args={args} platform="mobile" />,
	play: async ({ canvasElement, args }) => {
		const photos = nodeOf(canvasElement, "photos");
		const start = centerOf(photos);
		const hold = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(photos, "pointerdown", start, hold);
		await wait(480);
		await expect(
			document.querySelector("[data-reorder-overlay]"),
		).not.toBeNull();
		pointer(photos, "pointermove", { x: start.x + 2, y: start.y + 2 }, hold);
		pointer(photos, "pointerup", start, hold);
		await settled(canvasElement);
		await expect(args.onChannelLongPress).toHaveBeenCalledTimes(1);
		await expect(
			(args.onChannelLongPress as ReturnType<typeof fn>).mock.calls[0][0],
		).toMatchObject({ id: "photos" });
		await expect(args.onReorder).not.toHaveBeenCalled();

		const second = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(photos, "pointerdown", start, second);
		await wait(480);
		const down = { x: start.x, y: start.y + 160 };
		await glide(photos, start, down, second, 6);
		await waitFor(() =>
			expect(orderIn(canvasElement, "hangout")).not.toEqual([
				"general",
				"photos",
				"files",
			]),
		);
		pointer(
			document.body,
			"pointerdown",
			{ x: 40, y: 40 },
			{
				pointerType: "touch",
				pointerId: ++pointerSeed,
				isPrimary: false,
			},
		);
		await settled(canvasElement);
		await expect(orderIn(canvasElement, "hangout")).toEqual([
			"general",
			"photos",
			"files",
		]);
		await expect(args.onReorder).not.toHaveBeenCalled();
		await expect(args.onChannelLongPress).toHaveBeenCalledTimes(1);
	},
};

export const Autoscroll: Story = {
	render: (args) => <Playground args={args} platform="mobile" height="420px" />,
	play: async ({ canvasElement, args }) => {
		const scroller = canvasElement.querySelector(
			"[data-story-scroller]",
		) as HTMLElement;
		await expect(scroller.scrollTop).toBe(0);
		const general = nodeOf(canvasElement, "general");
		const start = centerOf(general);
		const hold = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(general, "pointerdown", start, hold);
		await wait(480);
		const edge = scroller.getBoundingClientRect().bottom - 8;
		await glide(general, start, { x: start.x, y: edge }, hold, 8);
		await wait(600);
		const scrolled = scroller.scrollTop;
		await expect(scrolled).toBeGreaterThan(150);
		await wait(200);
		await expect(scroller.scrollTop).toBeGreaterThan(scrolled);
		await expect(general.isConnected).toBe(false);
		await expect(touchMove(general, { x: start.x, y: edge })).toBe(true);
		pointer(general, "pointerup", { x: start.x, y: edge }, hold);
		await settled(canvasElement);
		const change = lastChange(args);
		await expect(change?.type).toBe("channel");
		await expect(
			change?.type === "channel" ? change.to.categoryId : undefined,
		).not.toBe("hangout");
	},
};

export const KeyboardReorder: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" reorderMode />,
	play: async ({ canvasElement, args, userEvent }) => {
		const canvas = within(canvasElement);
		const status = () =>
			canvasElement.querySelector('[role="status"]')?.textContent;
		const handle = canvas.getByRole("button", { name: "Reorder General" });
		handle.focus();
		await userEvent.keyboard(" ");
		await waitFor(() =>
			expect(status()).toContain(
				"Picked up General, position 1 of 3 in Hangout",
			),
		);
		await expect(handle).toHaveAttribute("aria-pressed", "true");
		await userEvent.keyboard("{ArrowDown}");
		await waitFor(() =>
			expect(status()).toBe("Moved General to position 2 of 3 in Hangout."),
		);
		await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard("{ArrowDown}");
		await waitFor(() =>
			expect(status()).toBe("Moved General to position 1 of 3 in Voice."),
		);
		await expect(orderIn(canvasElement, "voice")).toEqual([
			"general",
			"lounge",
			"call",
		]);
		const moved = canvas.getByRole("button", { name: "Reorder General" });
		await expect(document.activeElement).toBe(moved);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(status()).toBe(
				"Reorder cancelled. General is back at position 1 of 3 in Hangout.",
			),
		);
		await expect(orderIn(canvasElement, "hangout")[0]).toBe("general");
		await expect(args.onReorder).not.toHaveBeenCalled();

		await userEvent.keyboard(" ");
		await userEvent.keyboard("{ArrowUp}");
		await waitFor(() =>
			expect(status()).toBe(
				"Moved General to position 2 of 2 outside any category.",
			),
		);
		await userEvent.keyboard("{Enter}");
		await expect(lastChange(args)).toMatchObject({
			id: "general",
			to: { categoryId: null, index: 1 },
		});
		await expect(orderIn(canvasElement, null)).toEqual(["rules", "general"]);

		const voice = canvas.getByRole("button", { name: "Reorder Voice" });
		voice.focus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(
				Array.from(canvasElement.querySelectorAll("[data-category]")).every(
					(section) => section.hasAttribute("data-collapsed"),
				),
			).toBe(true),
		);
		await userEvent.keyboard("{ArrowUp}");
		await waitFor(() =>
			expect(status()).toBe("Moved Voice to position 1 of 5."),
		);
		await userEvent.keyboard(" ");
		await expect(lastChange(args)).toMatchObject({
			type: "category",
			id: "voice",
			to: 0,
		});
		await expect(categoryOrder(canvasElement)[0]).toBe("voice");

		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", { name: "Reorder Voice" }),
			).toBeNull(),
		);
	},
};

export const MobileReorderMode: Story = {
	render: (args) => <Playground args={args} platform="mobile" reorderMode />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const handle = canvas.getByRole("button", { name: "Reorder Photos" });
		const row = nodeOf(canvasElement, "photos");
		const rowBox = row.getBoundingClientRect();
		const handleBox = handle.getBoundingClientRect();
		await expect(handleBox.right).toBeLessThanOrEqual(rowBox.right + 0.5);
		await expect(handleBox.width).toBeGreaterThanOrEqual(32);
		await expect(getComputedStyle(handle).touchAction).toBe("none");
		const content = row.querySelector("[data-channel-row]") as HTMLElement;
		await expect(content.getBoundingClientRect().right).toBeLessThanOrEqual(
			handleBox.left + 0.5,
		);
		await expect(content.closest("[inert]")).not.toBeNull();

		const start = centerOf(handle);
		const touch = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(handle, "pointerdown", start, touch);
		const general = nodeOf(canvasElement, "general");
		const target = { x: start.x, y: centerOf(general).y - 14 };
		await glide(handle, start, target, touch, 6);
		await expect(
			document.querySelector("[data-reorder-overlay]"),
		).not.toBeNull();
		await waitFor(() =>
			expect(orderIn(canvasElement, "hangout")).toEqual([
				"photos",
				"general",
				"files",
			]),
		);
		pointer(handle, "pointerup", target, touch);
		await settled(canvasElement);
		await expect(lastChange(args)).toMatchObject({
			id: "photos",
			to: { categoryId: "hangout", index: 0 },
		});
		await canvas.getByRole("button", { name: "Done" }).click();
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", { name: "Reorder Photos" }),
			).toBeNull(),
		);
	},
};

export const SaveFails: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" failSaves />,
	play: async ({ canvasElement, args }) => {
		const general = nodeOf(canvasElement, "general");
		const files = centerOf(nodeOf(canvasElement, "files"));
		await mouseDrag(general, { x: files.x, y: files.y + 12 });
		await expect(orderIn(canvasElement, "hangout")).toEqual([
			"photos",
			"files",
			"general",
		]);
		await expect(args.onReorder).toHaveBeenCalledTimes(1);
		await waitFor(
			() =>
				expect(orderIn(canvasElement, "hangout")).toEqual([
					"general",
					"photos",
					"files",
				]),
			{ timeout: 2000 },
		);
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="status"]')?.textContent).toBe(
				"Couldn't move General. It's back at position 1 of 3 in Hangout.",
			),
		);
	},
};

export const WithoutPermission: Story = {
	render: (args) => (
		<Playground args={args} platform="mobile" canReorder={false} />
	),
	play: async ({ canvasElement, args }) => {
		await expect(
			canvasElement.querySelector("[data-reorder-handle]"),
		).toBeNull();
		const general = nodeOf(canvasElement, "general");
		const start = centerOf(general);
		const mouse = await mouseDrag(general, {
			x: start.x,
			y: start.y + 120,
		});
		await expect(mouse.pointerType).toBe("mouse");
		await expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
		await expect(orderIn(canvasElement, "hangout")[0]).toBe("general");

		const hold = { pointerType: "touch", pointerId: ++pointerSeed };
		pointer(general, "pointerdown", start, hold);
		await wait(480);
		await expect(args.onChannelLongPress).toHaveBeenCalledTimes(1);
		await expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
		await expect(touchMove(general, start)).toBe(false);
		pointer(general, "pointerup", start, hold);
		await expect(args.onReorder).not.toHaveBeenCalled();
	},
};

export const ReducedMotion: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" />,
	play: async ({ canvasElement }) => {
		document.documentElement.dataset.reducedMotion = "true";
		try {
			const general = nodeOf(canvasElement, "general");
			const init = await mouseDrag(
				general,
				centerOf(nodeOf(canvasElement, "files")),
				{ release: false },
			);
			const shifted = Array.from(
				canvasElement.querySelectorAll<HTMLElement>("[data-list-node]"),
			).filter((element) => element.getAnimations().length > 0);
			await expect(shifted).toEqual([]);
			const lift = document.querySelector<HTMLElement>("[data-reorder-lift]");
			await expect(lift?.getAnimations().length).toBe(0);
			pointer(general, "pointerup", centerOf(general), init);
			await frame();
			await expect(document.querySelector("[data-reorder-overlay]")).toBeNull();
		} finally {
			delete document.documentElement.dataset.reducedMotion;
		}
	},
};

export const DropOnCollapsedCategory: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" />,
	play: async ({ canvasElement, args }) => {
		const events = canvasElement.querySelector(
			'[data-list-category="events"]',
		) as HTMLElement;
		const header = events.querySelector(
			"[data-category-header]",
		) as HTMLElement;
		const photos = nodeOf(canvasElement, "photos");
		const start = centerOf(photos);
		const init = await mouseDrag(photos, start, { release: false });
		const over = { x: centerOf(header).x, y: centerOf(header).y + 12 };
		await glide(
			photos,
			{ x: start.x, y: start.y + NUDGE },
			{ x: over.x, y: over.y + NUDGE },
			init,
		);
		console.log(
			"DBG",
			JSON.stringify(
				["hangout", "voice", "archive", "events", "regions", null].map((c) => [
					c,
					orderIn(canvasElement, c),
				]),
			),
			JSON.stringify(header.getBoundingClientRect()),
			JSON.stringify(over),
			JSON.stringify(
				document
					.querySelector("[data-reorder-overlay]")
					?.getBoundingClientRect(),
			),
		);
		await expect(events).toHaveAttribute("data-drop-target");
		await expect(orderIn(canvasElement, "events")).toEqual([
			"meetups",
			"trips",
			"photos",
		]);
		pointer(photos, "pointerup", { x: over.x, y: over.y + NUDGE }, init);
		await settled(canvasElement);
		await expect(lastChange(args)).toMatchObject({
			id: "photos",
			to: { categoryId: "events", index: 2 },
		});
		await expect(events.querySelector("[data-category]")).toHaveAttribute(
			"data-collapsed",
		);
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="status"]')?.textContent).toBe(
				"Moved Photos to position 3 of 3 in Events.",
			),
		);
	},
};

export const MoveButtons: Story = {
	render: (args) => (
		<Playground args={args} platform="mobile" reorderMode failSaves={false} />
	),
	play: async ({ canvasElement, args, userEvent }) => {
		const canvas = within(canvasElement);
		const status = () =>
			canvasElement.querySelector('[role="status"]')?.textContent;
		const button = (name: string) => canvas.getByRole("button", { name });

		await expect(button("Move Rules up")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		await expect(button("Move Rules down")).not.toHaveAttribute(
			"aria-disabled",
		);
		await expect(button("Move Valleys down")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		await expect(button("Move Hangout up")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		await expect(button("Move Regions down")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		await userEvent.click(button("Move Rules up"));
		await expect(args.onReorder).not.toHaveBeenCalled();

		const photosDown = button("Move Photos down");
		const stepBox = photosDown.getBoundingClientRect();
		const handleBox = button("Reorder Photos").getBoundingClientRect();
		await expect(stepBox.right).toBeLessThanOrEqual(handleBox.left + 0.5);
		const row = nodeOf(canvasElement, "photos").querySelector(
			"[data-channel-row]",
		) as HTMLElement;
		await expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(
			stepBox.left + 0.5,
		);

		await userEvent.click(photosDown);
		await expect(args.onReorder).toHaveBeenCalledTimes(1);
		await expect(lastChange(args)).toMatchObject({
			type: "channel",
			id: "photos",
			from: { categoryId: "hangout", index: 1 },
			to: { categoryId: "hangout", index: 2 },
		});
		await expect(orderIn(canvasElement, "hangout")).toEqual([
			"general",
			"files",
			"photos",
		]);
		await waitFor(() =>
			expect(status()).toBe("Moved Photos to position 3 of 3 in Hangout."),
		);
		await expect(document.activeElement).toBe(button("Move Photos down"));

		await userEvent.click(button("Move Photos down"));
		await expect(args.onReorder).toHaveBeenCalledTimes(2);
		await expect(orderIn(canvasElement, "voice")).toEqual([
			"photos",
			"lounge",
			"call",
		]);
		await waitFor(() =>
			expect(status()).toBe("Moved Photos to position 1 of 3 in Voice."),
		);
		await expect(document.activeElement).toBe(button("Move Photos down"));

		await userEvent.click(button("Move General up"));
		await expect(orderIn(canvasElement, null)).toEqual(["rules", "general"]);
		await waitFor(() =>
			expect(status()).toBe(
				"Moved General to position 2 of 2 outside any category.",
			),
		);

		await userEvent.click(button("Move Voice up"));
		await expect(lastChange(args)).toMatchObject({
			type: "category",
			id: "voice",
			from: 1,
			to: 0,
		});
		await expect(categoryOrder(canvasElement)[0]).toBe("voice");
		await expect(button("Move Voice up")).toHaveAttribute(
			"aria-disabled",
			"true",
		);

		await userEvent.click(canvas.getByRole("checkbox"));
		const calls = (args.onReorder as ReturnType<typeof fn>).mock.calls.length;
		await userEvent.click(button("Move File sharing down"));
		await expect(args.onReorder).toHaveBeenCalledTimes(calls + 1);
		await expect(orderIn(canvasElement, "hangout")).toEqual([]);
		await expect(orderIn(canvasElement, "archive")).toEqual(["files"]);
		await waitFor(
			() => expect(orderIn(canvasElement, "hangout")).toEqual(["files"]),
			{ timeout: 2000 },
		);
		await expect(orderIn(canvasElement, "archive")).toEqual([]);
		await waitFor(() =>
			expect(status()).toBe(
				"Couldn't move File sharing. It's back at position 1 of 1 in Hangout.",
			),
		);
	},
};

export const ReorderModeFocus: Story = {
	parameters: desktop,
	render: (args) => <Playground args={args} platform="desktop" withMenu />,
	play: async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		const trigger = canvasElement.querySelector(
			"[data-space-name-button]",
		) as HTMLElement;
		await userEvent.click(trigger);
		const item = await waitFor(() =>
			within(document.body).getByRole("menuitem", {
				name: "Reorder channels",
			}),
		);
		await userEvent.click(item);
		const first = await waitFor(() =>
			canvas.getByRole("button", { name: "Reorder Rules" }),
		);
		await waitFor(() => expect(document.activeElement).toBe(first));
		await wait(700);
		await expect(document.activeElement).toBe(first);
		await expect(
			within(document.body).queryByRole("menuitem", {
				name: "Reorder channels",
			}),
		).toBeNull();

		await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
		await expect(document.activeElement).toBe(
			canvas.getByRole("button", { name: "Move Rules down" }),
		);
		await userEvent.click(canvas.getByRole("button", { name: "Done" }));
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", { name: "Reorder Rules" }),
			).toBeNull(),
		);
		await expect(document.activeElement).toBe(
			nodeOf(canvasElement, "rules").querySelector("button"),
		);
	},
};

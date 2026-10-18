import { createSignal, For, onMount, Show } from "solid-js";
import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { AttachmentTray } from "../components/Composer/AttachmentTray";
import { SegmentedControl } from "../components/SegmentedControl/SegmentedControl";
import { userPanelSurface } from "../components/Shell/UserPanel";
import { readableUserColor } from "../utils/name-color";
import {
	COLOR_TOKENS,
	CONTRAST_PAIRS,
	type ContrastPair,
	composite,
	contrastBetween,
	PARITY_PAIRS,
	PARITY_TOLERANCE,
	type ParityPair,
	pairRatio,
	parseColor,
	type Rgba,
	relativeLuminance,
	SURFACES,
	THEMES,
	type Theme,
	type ThemeTokens,
} from "./theme-contrast";

const meta = {
	title: "Foundations/Theme audit",
	parameters: {
		layout: "fullscreen",
		a11y: {
			config: { rules: [{ id: "color-contrast", enabled: false }] },
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const USER_COLORS = ["#ffffff", "#ffd857", "#4ade80", "#76c4e5", "#11111b"];

const themeLabel: Record<Theme, string> = {
	dark: "Dark theme",
	light: "Light theme",
};

const readTokens = (element: Element): ThemeTokens => {
	const style = getComputedStyle(element);
	return Object.fromEntries(
		COLOR_TOKENS.map((name) => [
			name,
			style.getPropertyValue(`--${name}`).trim(),
		]),
	);
};

const formatRatio = (ratio: number) => `${ratio.toFixed(2)}:1`;

const PairRow = (props: {
	pair: ContrastPair;
	tokens: ThemeTokens | undefined;
}) => {
	const ratio = () =>
		props.tokens ? pairRatio(props.tokens, props.pair) : undefined;
	const passes = () => (ratio() ?? 0) >= props.pair.minimum;
	const sampleBackground = () =>
		props.pair.tint === undefined
			? `var(--${props.pair.background})`
			: `linear-gradient(color-mix(in srgb, var(--${props.pair.foreground}) ${props.pair.tint * 100}%, transparent), color-mix(in srgb, var(--${props.pair.foreground}) ${props.pair.tint * 100}%, transparent)), var(--${props.pair.background})`;

	return (
		<li
			data-pair={props.pair.id}
			data-minimum={props.pair.minimum}
			class="flex items-center gap-3 py-1.5"
		>
			<span
				aria-hidden="true"
				class="flex h-8 w-12 shrink-0 items-center justify-center rounded-control-sm border border-border text-sm font-semibold"
				style={{
					background: sampleBackground(),
					color: `var(--${props.pair.foreground})`,
				}}
			>
				{props.pair.kind === "text" ? "Aa" : "●"}
			</span>
			<span class="min-w-0 flex-1 truncate font-mono text-xs">
				{props.pair.id}
			</span>
			<Show when={ratio()}>
				{(value) => (
					<span class="shrink-0 font-mono text-xs tabular-nums">
						{formatRatio(value())}
					</span>
				)}
			</Show>
			<span
				class="w-24 shrink-0 text-right text-xs font-semibold"
				classList={{
					"text-success": passes(),
					"text-warning": !passes(),
				}}
			>
				{passes() ? `AA ${props.pair.minimum}:1` : "Below AA"}
			</span>
		</li>
	);
};

const ParityRow = (props: {
	pair: ParityPair;
	tokens: ThemeTokens | undefined;
}) => {
	const ratio = () =>
		props.tokens ? pairRatio(props.tokens, props.pair) : undefined;
	return (
		<li data-parity={props.pair.id} class="flex items-center gap-3 py-1.5">
			<span
				aria-hidden="true"
				class="flex h-8 w-12 shrink-0 items-center justify-center rounded-control-sm"
				style={{ background: `var(--${props.pair.background})` }}
			>
				<span
					class="size-5 rounded-control-xs"
					style={{
						background: props.pair.foreground.endsWith("border")
							? "transparent"
							: `var(--${props.pair.foreground})`,
						border: props.pair.foreground.endsWith("border")
							? `2px solid var(--${props.pair.foreground})`
							: undefined,
					}}
				/>
			</span>
			<span class="min-w-0 flex-1 truncate font-mono text-xs">
				{props.pair.id}
			</span>
			<Show when={ratio()}>
				{(value) => (
					<span class="shrink-0 font-mono text-xs tabular-nums">
						{formatRatio(value())}
					</span>
				)}
			</Show>
		</li>
	);
};

const ThemePanel = (props: { theme: Theme }) => {
	let panel: HTMLElement | undefined;
	const [tokens, setTokens] = createSignal<ThemeTokens>();

	onMount(() => {
		if (panel) setTokens(readTokens(panel));
	});

	return (
		<section
			ref={(element) => {
				panel = element;
			}}
			data-theme={props.theme}
			data-theme-panel={props.theme}
			aria-label={themeLabel[props.theme]}
			class="flex min-w-0 flex-col gap-6 rounded-surface border border-border bg-background p-4 text-foreground"
		>
			<h2 class="m-0 text-xl font-bold">{themeLabel[props.theme]}</h2>

			<div class="flex flex-col gap-2">
				<h3 class="m-0 eyebrow text-muted-foreground">Contrast pairs</h3>
				<ul class="m-0 flex list-none flex-col divide-y divide-border p-0">
					<For each={CONTRAST_PAIRS}>
						{(pair) => <PairRow pair={pair} tokens={tokens()} />}
					</For>
				</ul>
			</div>

			<div class="flex flex-col gap-2">
				<h3 class="m-0 eyebrow text-muted-foreground">Elevation steps</h3>
				<ul class="m-0 flex list-none flex-col divide-y divide-border p-0">
					<For each={PARITY_PAIRS}>
						{(pair) => <ParityRow pair={pair} tokens={tokens()} />}
					</For>
				</ul>
			</div>

			<div class="flex flex-col gap-2">
				<h3 class="m-0 eyebrow text-muted-foreground">Name colors</h3>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					<For each={USER_COLORS}>
						{(color) => (
							<li
								data-name-color={color}
								class="flex items-center gap-3 rounded-control-sm bg-secondary-highlight px-3 py-2"
							>
								<span
									class="flex-1 text-base font-semibold"
									style={{ color: readableUserColor(color, props.theme) }}
								>
									Kris
								</span>
								<span class="font-mono text-xs text-muted-foreground">
									{color} → {readableUserColor(color, props.theme)}
								</span>
							</li>
						)}
					</For>
				</ul>
			</div>

			<div class="flex flex-col gap-2">
				<h3 class="m-0 eyebrow text-muted-foreground">Surfaces</h3>
				<div class="flex flex-col gap-3 rounded-surface bg-card p-3 shadow-overlay">
					<p class="m-0 text-sm">Card with an overlay shadow</p>
					<div class="flex flex-col gap-2 rounded-surface border border-border bg-popover p-3 shadow-overlay">
						<p class="m-0 text-sm">Popover on the card</p>
						<div class="rounded-control bg-popover-highlight px-3 py-2 text-sm">
							Highlighted row
						</div>
						<div class="rounded-control border border-control-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
							Input placeholder
						</div>
					</div>
					<div
						data-skeleton=""
						aria-hidden="true"
						class="h-4 w-40 rounded-control-xs"
					/>
				</div>
			</div>
		</section>
	);
};

export const SideBySide: Story = {
	render: () => (
		<div class="grid grid-cols-1 gap-4 bg-background p-4 lg:grid-cols-2">
			<For each={THEMES}>{(theme) => <ThemePanel theme={theme} />}</For>
		</div>
	),
	play: async ({ canvasElement, step }) => {
		const panelFor = (theme: Theme) => {
			const panel = canvasElement.querySelector<HTMLElement>(
				`[data-theme-panel="${theme}"]`,
			);
			if (!panel) throw new Error(`${theme} panel missing`);
			return panel;
		};

		await step("every color token resolves in both themes", async () => {
			for (const theme of THEMES) {
				const tokens = readTokens(panelFor(theme));
				for (const name of COLOR_TOKENS) {
					await expect(
						parseColor(tokens[name]),
						`${theme} --${name}: ${tokens[name]}`,
					).toBeDefined();
				}
			}
		});

		await step("each panel carries its own theme", async () => {
			const dark = parseColor(readTokens(panelFor("dark")).background);
			const light = parseColor(readTokens(panelFor("light")).background);
			if (!dark || !light) throw new Error("background did not resolve");
			await expect(relativeLuminance(dark)).toBeLessThan(0.05);
			await expect(relativeLuminance(light)).toBeGreaterThan(0.8);
			for (const theme of THEMES) {
				const panel = panelFor(theme);
				await expect(getComputedStyle(panel).colorScheme).toBe(theme);
			}
		});

		await step("utilities read the scoped tokens", async () => {
			for (const theme of THEMES) {
				const panel = panelFor(theme);
				const tokens = readTokens(panel);
				const painted = parseColor(getComputedStyle(panel).backgroundColor);
				await expect(painted).toEqual(parseColor(tokens.background));
				const muted = panel.querySelector("h3");
				if (!muted) throw new Error("heading missing");
				await expect(parseColor(getComputedStyle(muted).color)).toEqual(
					parseColor(tokens["muted-foreground"]),
				);
			}
		});

		await step("contrast pairs meet their minimum in the browser", async () => {
			for (const theme of THEMES) {
				const tokens = readTokens(panelFor(theme));
				for (const pair of CONTRAST_PAIRS) {
					await expect(
						pairRatio(tokens, pair),
						`${theme}: ${pair.id}`,
					).toBeGreaterThanOrEqual(pair.minimum);
				}
			}
		});

		await step("light elevation steps match dark", async () => {
			const dark = readTokens(panelFor("dark"));
			const light = readTokens(panelFor("light"));
			for (const pair of PARITY_PAIRS) {
				await expect(pairRatio(light, pair), pair.id).toBeGreaterThanOrEqual(
					pairRatio(dark, pair) * PARITY_TOLERANCE,
				);
			}
		});

		await step("name colors stay readable on every surface", async () => {
			for (const theme of THEMES) {
				const panel = panelFor(theme);
				const tokens = readTokens(panel);
				for (const row of panel.querySelectorAll(
					"[data-name-color] > span:first-child",
				)) {
					const color = getComputedStyle(row).color;
					const withName = { ...tokens, "name-color": color };
					for (const surface of SURFACES) {
						await expect(
							pairRatio(withName, {
								foreground: "name-color",
								background: surface,
							}),
							`${theme}: ${color} on ${surface}`,
						).toBeGreaterThanOrEqual(4.5);
					}
				}
			}
		});
	},
};

const previewImage =
	"data:image/svg+xml;utf8," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#c4a7ff"/></svg>',
	);

const ComponentPanel = (props: { theme: Theme }) => (
	<section
		data-theme={props.theme}
		data-fix-panel={props.theme}
		aria-label={themeLabel[props.theme]}
		class="flex min-w-0 flex-col gap-4 rounded-surface bg-background p-4 text-foreground"
	>
		<SegmentedControl
			aria-label="Sort order"
			defaultValue="new"
			options={[
				{ value: "new", label: "Newest" },
				{ value: "old", label: "Oldest" },
			]}
		/>
		<AttachmentTray
			items={[
				{
					id: "upload",
					name: "sketch.png",
					size: 48_000,
					previewSrc: previewImage,
					progress: 0.4,
				},
			]}
		/>
		<div data-user-panel="" class={userPanelSurface}>
			<p class="m-0 p-3 text-sm">User panel surface</p>
		</div>
	</section>
);

const rasterize = (value: string): Rgba | undefined => {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return undefined;
	context.fillStyle = value;
	context.fillRect(0, 0, 1, 1);
	const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
	return [red, green, blue, alpha / 255];
};

const SEGMENT_THUMB = '[class*="left-0.5"]';

const shadowColor = (element: Element) => {
	const colors = Array.from(
		getComputedStyle(element).boxShadow.matchAll(/rgba?\([^)]*\)/g),
		(match) => parseColor(match[0]),
	);
	return colors.find((color) => color !== undefined && color[3] > 0);
};

const paintedBackground = (element: Element): ReturnType<typeof parseColor> => {
	let color = parseColor(getComputedStyle(element).backgroundColor);
	let parent = element.parentElement;
	while (color && color[3] < 1 && parent) {
		const below = parseColor(getComputedStyle(parent).backgroundColor);
		if (below && below[3] > 0) color = composite(color, below);
		parent = parent.parentElement;
	}
	return color;
};

export const LightComponentFixes: Story = {
	render: () => (
		<div class="grid grid-cols-1 gap-4 bg-background p-4 sm:grid-cols-2">
			<For each={THEMES}>{(theme) => <ComponentPanel theme={theme} />}</For>
		</div>
	),
	play: async ({ canvasElement, step }) => {
		const panelFor = (theme: Theme) => {
			const panel = canvasElement.querySelector<HTMLElement>(
				`[data-fix-panel="${theme}"]`,
			);
			if (!panel) throw new Error(`${theme} panel missing`);
			return panel;
		};

		await step("segmented thumb reads as raised in both themes", async () => {
			for (const theme of THEMES) {
				const panel = panelFor(theme);
				const track = panel.querySelector("[data-segmented-control]");
				const thumb = track?.querySelector(SEGMENT_THUMB);
				if (!track || !thumb) throw new Error("segmented control missing");
				const trackColor = paintedBackground(track);
				const thumbColor = paintedBackground(thumb);
				if (!trackColor || !thumbColor) throw new Error("no fill");
				await expect(
					relativeLuminance(thumbColor),
					`${theme} thumb is lighter than its track`,
				).toBeGreaterThan(relativeLuminance(trackColor));
			}
		});

		await step("fixed shadows follow --shadow-color", async () => {
			for (const theme of THEMES) {
				const panel = panelFor(theme);
				const expected = parseColor(readTokens(panel)["shadow-color"]);
				const thumb = panel.querySelector(
					`[data-segmented-control] ${SEGMENT_THUMB}`,
				);
				if (!thumb) throw new Error("thumb missing");
				await expect(shadowColor(thumb)).toEqual(expected);
			}
			const darkPanel = shadowColor(
				panelFor("dark").querySelector("[data-user-panel]") as Element,
			);
			const lightPanel = shadowColor(
				panelFor("light").querySelector("[data-user-panel]") as Element,
			);
			if (!darkPanel || !lightPanel) throw new Error("no user panel shadow");
			await expect(lightPanel[3]).toBeLessThan(darkPanel[3]);
		});

		await step("upload ring stays visible on the scrim", async () => {
			for (const theme of THEMES) {
				const panel = panelFor(theme);
				const progress = panel.querySelector('[role="progressbar"]');
				const track = panel.querySelector("[data-upload-track]");
				const arc = panel.querySelector("[data-upload-arc]");
				if (!progress || !track || !arc) throw new Error("ring missing");
				const scrim = rasterize(getComputedStyle(progress).backgroundColor);
				const image = parseColor("#c4a7ff");
				const trackStroke = rasterize(getComputedStyle(track).stroke);
				const arcStroke = rasterize(getComputedStyle(arc).stroke);
				if (!scrim || !image || !trackStroke || !arcStroke) {
					throw new Error("ring colors did not resolve");
				}
				const behind = composite(scrim, image);
				await expect(
					contrastBetween(composite(arcStroke, behind), behind),
					`${theme} arc`,
				).toBeGreaterThanOrEqual(3);
				await expect(
					contrastBetween(composite(trackStroke, behind), behind),
					`${theme} track`,
				).toBeGreaterThan(1.2);
			}
		});
	},
};

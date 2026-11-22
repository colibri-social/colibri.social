import { createSignal, For } from "solid-js";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { simulateSpring, springEasing, springs } from "../utils/motion";

const meta = {
	title: "Foundations/Tokens",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const colors = [
	"background",
	"card",
	"popover",
	"popover-highlight",
	"primary",
	"primary-highlight",
	"primary-fill",
	"primary-fill-highlight",
	"secondary",
	"secondary-highlight",
	"muted",
	"muted-foreground",
	"accent",
	"destructive",
	"destructive-highlight",
	"destructive-fill",
	"destructive-fill-highlight",
	"success",
	"warning",
	"info",
	"control-border",
	"border",
	"mention",
];

export const Colors: Story = {
	render: () => (
		<div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
			<For each={colors}>
				{(name) => (
					<div class="flex flex-col overflow-hidden rounded-surface border border-border">
						<div class="h-20" style={{ background: `var(--${name})` }} />
						<div class="bg-card p-2 font-mono text-xs">--{name}</div>
					</div>
				)}
			</For>
		</div>
	),
};

export const Typography: Story = {
	render: () => (
		<div class="flex flex-col gap-4">
			<p class="font-display text-5xl">Welcome to Colibri Social</p>
			<p class="text-[32px] font-bold">Let's get your profile going.</p>
			<p class="text-xl font-bold">Awesome Channel</p>
			<p class="text-xl font-semibold">Modal title</p>
			<p class="text-base font-semibold">Username</p>
			<p class="text-base">
				Just past it, sat on the rail for a good minute :)
			</p>
			<p class="text-sm font-semibold">Button label</p>
			<p class="text-sm font-medium text-muted-foreground">Field label</p>
			<p class="text-xs text-muted-foreground">
				This is the status of the user
			</p>
			<p class="font-mono text-sm">did:plc:abcdefghijklmnop</p>
		</div>
	),
};

const SpringCurve = (props: {
	name: string;
	config: { stiffness: number; damping: number };
}) => {
	const samples = () => simulateSpring(props.config);
	const path = () => {
		const values = samples();
		const max = Math.max(1.2, ...values);
		return values
			.map((value, index) => {
				const x = (index / (values.length - 1)) * 200;
				const y = 80 - (value / max) * 70;
				return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(" ");
	};
	const [playing, setPlaying] = createSignal(false);

	return (
		<div class="flex flex-col gap-2 rounded-surface border border-border bg-card p-3">
			<div class="flex items-baseline justify-between font-mono text-xs">
				<span>{props.name}</span>
				<span class="text-muted-foreground">
					k={props.config.stiffness} c={props.config.damping} ·{" "}
					{springEasing(props.config).duration}ms
				</span>
			</div>
			<svg
				viewBox="0 0 200 84"
				class="h-21 w-full"
				role="img"
				aria-label={`${props.name} spring curve`}
			>
				<line
					x1="0"
					x2="200"
					y1={80 - 70 / Math.max(1.2, ...samples())}
					y2={80 - 70 / Math.max(1.2, ...samples())}
					stroke="var(--border)"
				/>
				<path d={path()} fill="none" stroke="var(--primary)" stroke-width="2" />
			</svg>
			<button
				type="button"
				aria-label={`Play ${props.name} spring`}
				class="h-8 rounded-control-sm bg-secondary text-xs font-semibold"
				onClick={() => setPlaying(!playing())}
			>
				<span
					class="inline-block size-3 rounded-full bg-primary"
					style={{
						transform: `translateX(${playing() ? 60 : -60}px)`,
						transition: `transform calc(${springEasing(props.config).duration}ms * var(--motion-scale)) ${springEasing(props.config).easing}`,
					}}
				/>
			</button>
		</div>
	);
};

const radii = [
	{
		token: "control-xs",
		value: "6px",
		heights: "24px and under",
		examples: "Chip, badge box",
		height: 24,
	},
	{
		token: "control-sm",
		value: "8px",
		heights: "28 to 32px",
		examples: "IconButton sm and md, sidebar item",
		height: 32,
	},
	{
		token: "control",
		value: "10px",
		heights: "36 to 40px",
		examples: "Button, input, IconButton lg, tab, list box, secondary card",
		height: 40,
	},
	{
		token: "control-lg",
		value: "12px",
		heights: "44px and up",
		examples: "IconButton xl, text area, composer box",
		height: 48,
	},
	{
		token: "surface",
		value: "12px",
		heights: "Surfaces",
		examples: "Tab root card, popover, modal, embed",
		height: 64,
	},
	{
		token: "sheet",
		value: "16px",
		heights: "Sheets",
		examples: "Drawer top corners",
		height: 64,
	},
];

export const Radii: Story = {
	render: () => (
		<table class="w-full border-separate border-spacing-y-3 text-left text-sm">
			<thead class="text-xs text-muted-foreground">
				<tr>
					<th class="font-medium">Token</th>
					<th class="font-medium">Radius</th>
					<th class="font-medium">Height</th>
					<th class="font-medium">Used for</th>
					<th class="font-medium">Example</th>
				</tr>
			</thead>
			<tbody>
				<For each={radii}>
					{(radius) => (
						<tr>
							<td class="font-mono text-xs">rounded-{radius.token}</td>
							<td class="tabular-nums">{radius.value}</td>
							<td class="text-muted-foreground">{radius.heights}</td>
							<td class="text-muted-foreground">{radius.examples}</td>
							<td>
								<div
									class="w-24 border border-border bg-secondary"
									style={{
										height: `${radius.height}px`,
										"border-radius": `var(--radius-${radius.token})`,
									}}
								/>
							</td>
						</tr>
					)}
				</For>
			</tbody>
		</table>
	),
};

export const Springs: Story = {
	render: () => (
		<div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
			<For each={Object.entries(springs)}>
				{([name, config]) => <SpringCurve name={name} config={config} />}
			</For>
		</div>
	),
};

import { createSignal, For, type JSX } from "solid-js";
import { expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../../components/Button/Button";
import { IconButton } from "../../components/IconButton/IconButton";
import type { AnimatedIconHandle } from "./AnimatedIcon";
import {
	AnimatedBoltIcon,
	AnimatedBugIcon,
	AnimatedInboxIcon,
	AnimatedPipetteIcon,
	AnimatedShareCircleIcon,
	AnimatedSunFogIcon,
	AnimatedSunIcon,
	AnimatedTestTubeIcon,
	AnimatedTuningIcon,
} from "./system";

const meta = {
	title: "Icons/System",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Entry = {
	label: string;
	icon: (ref?: (handle: AnimatedIconHandle) => void) => JSX.Element;
};

const entries: Entry[] = [
	{ label: "Advanced", icon: (ref) => <AnimatedTuningIcon ref={ref} /> },
	{ label: "Debug", icon: (ref) => <AnimatedBugIcon ref={ref} /> },
	{ label: "Experiments", icon: (ref) => <AnimatedTestTubeIcon ref={ref} /> },
	{ label: "Inbox", icon: (ref) => <AnimatedInboxIcon ref={ref} /> },
	{ label: "Light theme", icon: (ref) => <AnimatedSunIcon ref={ref} /> },
	{ label: "System theme", icon: (ref) => <AnimatedSunFogIcon ref={ref} /> },
	{ label: "Bolt", icon: (ref) => <AnimatedBoltIcon ref={ref} /> },
	{ label: "Pick color", icon: (ref) => <AnimatedPipetteIcon ref={ref} /> },
	{ label: "Bridges", icon: (ref) => <AnimatedShareCircleIcon ref={ref} /> },
];

const Cell = (props: { label: string; children: JSX.Element }) => (
	<div class="flex w-28 flex-col items-center gap-2">
		{props.children}
		<span class="text-center text-xs text-muted-foreground">{props.label}</span>
	</div>
);

export const Gallery: Story = {
	render: () => (
		<div class="flex flex-wrap gap-4">
			<For each={entries}>
				{(entry) => (
					<Cell label={entry.label}>
						<IconButton size="xl" label={entry.label} icon={entry.icon()} />
					</Cell>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll("[data-animated-icon]"),
		).toHaveLength(entries.length);
	},
};

export const Attention: Story = {
	render: () => {
		const handles: AnimatedIconHandle[] = [];
		return (
			<div class="flex flex-wrap gap-6">
				<For each={entries}>
					{(entry, index) => (
						<Cell label={entry.label}>
							<div class="flex size-12 items-center justify-center">
								{entry.icon((handle) => {
									handles[index()] = handle;
								})}
							</div>
							<Button
								variant="secondary"
								onClick={() => handles[index()]?.play()}
							>
								Play
							</Button>
						</Cell>
					)}
				</For>
			</div>
		);
	},
};

export const InboxUnread: Story = {
	render: () => {
		const [unread, setUnread] = createSignal(false);
		return (
			<div class="flex items-center gap-6">
				<IconButton
					size="xl"
					label={unread() ? "Inbox, unread messages" : "Inbox"}
					onClick={() => setUnread(!unread())}
					icon={<AnimatedInboxIcon unread={unread()} />}
				/>
				<span class="text-sm text-muted-foreground">
					Press to toggle the unread dot
				</span>
			</div>
		);
	},
};

export const Loops: Story = {
	render: () => {
		const [on, setOn] = createSignal(true);
		return (
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap gap-6">
					<Cell label="Sun · rays turn">
						<AnimatedSunIcon size={32} loop={on()} />
					</Cell>
					<Cell label="Bolt · pulse">
						<AnimatedBoltIcon size={32} loop={on()} />
					</Cell>
				</div>
				<Button
					variant="secondary"
					class="self-start"
					onClick={() => setOn(!on())}
				>
					{on() ? "Stop loops" : "Start loops"}
				</Button>
			</div>
		);
	},
};

export const InboxCatch: Story = {
	render: () => {
		let handle: AnimatedIconHandle | undefined;
		return (
			<IconButton
				size="xl"
				label="Inbox, unread messages"
				onClick={() => handle?.play()}
				icon={
					<AnimatedInboxIcon
						unread
						ref={(value) => {
							handle = value;
						}}
					/>
				}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const icon = canvasElement.querySelector<SVGSVGElement>(
			'[data-animated-icon="inbox"]',
		);
		const part = (name: string) =>
			icon?.querySelector(`[data-part="${name}"]`) ?? undefined;
		canvasElement.querySelector("button")?.click();
		await waitFor(() =>
			expect(icon?.hasAttribute("data-attention")).toBe(true),
		);
		for (const name of ["lid", "tray", "dot"]) {
			await expect(part(name)?.getAnimations().length).toBeGreaterThan(0);
		}
		await waitFor(
			() => expect(icon?.hasAttribute("data-attention")).toBe(false),
			{ timeout: 3000 },
		);
	},
};

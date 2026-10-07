import { BellIcon } from "@solar-icons/solid/bold/bell";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { createSignal, For, type JSX } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../../components/Button/Button";
import { IconButton } from "../../components/IconButton/IconButton";
import { MicrophoneSlashIcon } from "../custom";
import type { AnimatedIconHandle } from "./AnimatedIcon";
import {
	AnimatedBellIcon,
	AnimatedChevronIcon,
	AnimatedCopyIcon,
	AnimatedHeartIcon,
	AnimatedMicrophoneIcon,
	AnimatedSendIcon,
	AnimatedSettingsIcon,
	AnimatedTrashIcon,
} from "./icons";

const meta = {
	title: "Foundations/Animated Icons",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Cell = (props: { label: string; children: JSX.Element }) => (
	<div class="flex w-28 flex-col items-center gap-2">
		{props.children}
		<span class="text-center text-xs text-muted-foreground">{props.label}</span>
	</div>
);

export const HoverAndPress: Story = {
	render: () => (
		<div class="flex flex-col gap-6">
			<p class="text-sm text-muted-foreground">
				Hover with a mouse, or press on touch. Each plays once and finishes even
				when the pointer leaves.
			</p>
			<div class="flex flex-wrap gap-4">
				<Cell label="Bell · bounce on press">
					<IconButton
						size="xl"
						label="Notifications"
						icon={<AnimatedBellIcon />}
					/>
				</Cell>
				<Cell label="Microphone · bounce on press">
					<IconButton
						size="xl"
						label="Microphone"
						icon={<AnimatedMicrophoneIcon />}
					/>
				</Cell>
				<Cell label="Settings · spin">
					<IconButton
						size="xl"
						label="Settings"
						icon={<AnimatedSettingsIcon />}
					/>
				</Cell>
				<Cell label="Copy · shuffle">
					<IconButton size="xl" label="Copy" icon={<AnimatedCopyIcon />} />
				</Cell>
				<Cell label="Trash · lid lift">
					<IconButton size="xl" label="Delete" icon={<AnimatedTrashIcon />} />
				</Cell>
				<Cell label="Send · nudge">
					<IconButton
						size="xl"
						variant="primary"
						label="Send"
						icon={<AnimatedSendIcon />}
					/>
				</Cell>
				<Cell label="Heart · bounce">
					<IconButton size="xl" label="React" icon={<AnimatedHeartIcon />} />
				</Cell>
			</div>
			<div class="flex flex-wrap gap-3">
				<Button variant="secondary" icon={<AnimatedBellIcon />}>
					Enable notifications
				</Button>
				<Button variant="destructive" icon={<AnimatedTrashIcon />}>
					Delete channel
				</Button>
			</div>
		</div>
	),
};

HoverAndPress.play = async ({ canvasElement }) => {
	const button = within(canvasElement).getByRole("button", {
		name: "Settings",
	});
	const icon = button.querySelector("[data-animated-icon]")!;
	const seen: boolean[] = [];
	const observer = new MutationObserver(() => {
		seen.push(icon.hasAttribute("data-hover"));
	});
	observer.observe(icon, { attributes: true, attributeFilter: ["data-hover"] });
	try {
		await userEvent.hover(button);
		await waitFor(() => expect(seen).toContain(true), { timeout: 3000 });
		await userEvent.unhover(button);
		await waitFor(() => expect(icon).not.toHaveAttribute("data-hover"), {
			timeout: 3000,
		});
	} finally {
		observer.disconnect();
	}
};

export const StateChanges: Story = {
	render: () => {
		const [muted, setMuted] = createSignal(false);
		const [bellMuted, setBellMuted] = createSignal(false);
		const [copied, setCopied] = createSignal(false);
		const [open, setOpen] = createSignal(false);
		let resetTimer: ReturnType<typeof setTimeout> | undefined;

		return (
			<div class="flex flex-wrap gap-4">
				<Cell label="Mute · draw slash">
					<IconButton
						size="xl"
						label={muted() ? "Unmute" : "Mute"}
						aria-pressed={muted()}
						onClick={() => setMuted(!muted())}
						icon={<AnimatedMicrophoneIcon muted={muted()} />}
					/>
				</Cell>
				<Cell label="Bell · draw slash">
					<IconButton
						size="xl"
						label={bellMuted() ? "Unmute channel" : "Mute channel"}
						aria-pressed={bellMuted()}
						onClick={() => setBellMuted(!bellMuted())}
						icon={<AnimatedBellIcon muted={bellMuted()} />}
					/>
				</Cell>
				<Cell label="Copy → check · replace">
					<IconButton
						size="xl"
						label={copied() ? "Copied" : "Copy invite link"}
						onClick={() => {
							setCopied(true);
							clearTimeout(resetTimer);
							resetTimer = setTimeout(() => setCopied(false), 1600);
						}}
						icon={<AnimatedCopyIcon copied={copied()} />}
					/>
				</Cell>
				<Cell label="Chevron · rotate">
					<IconButton
						size="xl"
						variant="ghost"
						label={open() ? "Collapse" : "Expand"}
						aria-expanded={open()}
						onClick={() => setOpen(!open())}
						icon={<AnimatedChevronIcon open={open()} />}
					/>
				</Cell>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Mute" }));
		const icon = canvasElement.querySelector(
			'[data-animated-icon="microphone"]',
		)!;
		await expect(icon.querySelector("[data-slashed]")).toHaveAttribute(
			"data-slashed",
			"on",
		);
		const slash = icon.querySelector("[data-slash]:not(mask [data-slash])")!;
		await waitFor(() =>
			expect(getComputedStyle(slash).strokeDashoffset).toBe("0px"),
		);
	},
};

export const Attention: Story = {
	render: () => {
		const handles: Record<string, AnimatedIconHandle> = {};
		const effects = [
			{
				id: "bell",
				label: "Bell · ring",
				effect: "ring",
				icon: (ref: (h: AnimatedIconHandle) => void) => (
					<AnimatedBellIcon size={32} ref={ref} />
				),
			},
			{
				id: "send",
				label: "Send · fly",
				effect: "send",
				icon: (ref: (h: AnimatedIconHandle) => void) => (
					<AnimatedSendIcon size={32} ref={ref} />
				),
			},
			{
				id: "heart",
				label: "Heart · pop",
				effect: "pop",
				icon: (ref: (h: AnimatedIconHandle) => void) => (
					<AnimatedHeartIcon size={32} ref={ref} />
				),
			},
		];
		return (
			<div class="flex flex-wrap gap-6">
				<For each={effects}>
					{(item) => (
						<Cell label={item.label}>
							<div class="flex size-12 items-center justify-center">
								{item.icon((handle) => {
									handles[item.id] = handle;
								})}
							</div>
							<Button
								variant="secondary"
								onClick={() => handles[item.id]?.play(item.effect)}
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

export const Ambient: Story = {
	render: () => {
		const [on, setOn] = createSignal(true);
		return (
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap gap-6">
					<Cell label="Settings · spin (syncing)">
						<AnimatedSettingsIcon size={32} loop={on()} />
					</Cell>
					<Cell label="Heart · heartbeat">
						<AnimatedHeartIcon size={32} loop={on()} class="text-destructive" />
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

export const MatchesStaticGlyphs: Story = {
	render: () => (
		<div class="flex flex-col gap-4">
			<p class="text-sm text-muted-foreground">
				Animated (left) next to the static source glyph (right), overlaid at 50%
				in the last column.
			</p>
			<For
				each={[
					{
						label: "Bell",
						animated: <AnimatedBellIcon size={48} />,
						source: <BellIcon size={48} />,
					},
					{
						label: "Copy",
						animated: <AnimatedCopyIcon size={48} />,
						source: <CopyIcon size={48} />,
					},
					{
						label: "Muted microphone",
						animated: <AnimatedMicrophoneIcon size={48} muted />,
						source: <MicrophoneSlashIcon size={48} />,
					},
				]}
			>
				{(row) => (
					<div class="flex items-center gap-6">
						<span class="w-36 text-sm">{row.label}</span>
						{row.animated}
						{row.source}
						<span class="relative size-12">
							<span class="absolute inset-0 text-primary opacity-50">
								{row.animated}
							</span>
							<span class="absolute inset-0 text-success opacity-50">
								{row.source}
							</span>
						</span>
					</div>
				)}
			</For>
		</div>
	),
};

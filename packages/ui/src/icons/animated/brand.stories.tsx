import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { For, type JSX } from "solid-js";
import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../../components/IconButton/IconButton";
import {
	AnimatedAtmosphereIcon,
	AnimatedBlueskyIcon,
	AnimatedGifIcon,
	AtmosphereGlyph,
	BlueskyLogo,
	GifGlyph,
	PdslsLogo,
	PlayTesterBadge,
} from "./brand";

const meta = {
	title: "Icons/Brand",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const animated: { label: string; icon: () => JSX.Element }[] = [
	{ label: "Bluesky", icon: () => <AnimatedBlueskyIcon /> },
	{ label: "Atmosphere account", icon: () => <AnimatedAtmosphereIcon /> },
	{ label: "GIF", icon: () => <AnimatedGifIcon /> },
];

const statics: {
	label: string;
	icon: (size: number) => JSX.Element;
}[] = [
	{ label: "PDSls", icon: (size) => <PdslsLogo size={size} /> },
	{ label: "Bluesky", icon: (size) => <BlueskyLogo size={size} /> },
	{
		label: "Play tester badge",
		icon: (size) => <PlayTesterBadge size={size} />,
	},
	{ label: "Atmosphere", icon: (size) => <AtmosphereGlyph size={size} /> },
	{ label: "GIF", icon: (size) => <GifGlyph size={size} /> },
];

export const Gallery: Story = {
	render: () => (
		<div class="flex flex-col gap-8">
			<div class="flex flex-wrap gap-4">
				<For each={animated}>
					{(item) => (
						<div class="flex w-28 flex-col items-center gap-2">
							<IconButton size="xl" label={item.label} icon={item.icon()} />
							<span class="text-center text-xs text-muted-foreground">
								{item.label}
							</span>
						</div>
					)}
				</For>
			</div>
			<div class="flex flex-col gap-3">
				<For each={[16, 24]}>
					{(size) => (
						<div class="flex items-center gap-4">
							<span class="w-10 text-xs text-muted-foreground tabular-nums">
								{size}px
							</span>
							<SettingsIcon size={size} />
							<For each={statics}>{(item) => item.icon(size)}</For>
							<SettingsIcon size={size} />
						</div>
					)}
				</For>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll("[data-animated-icon]"),
		).toHaveLength(animated.length);
	},
};

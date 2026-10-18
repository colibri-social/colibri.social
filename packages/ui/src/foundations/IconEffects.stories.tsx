import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { HomeIcon } from "@solar-icons/solid/bold/home";
import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import { KeyIcon } from "@solar-icons/solid/bold/key";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { ShieldCheckIcon } from "@solar-icons/solid/bold/shield-check";
import { For, type JSX } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../components/Button/Button";
import { IconButton } from "../components/IconButton/IconButton";
import { type IconEffect, iconEffect } from "../utils/icon-fx";

const meta = {
	title: "Foundations/Icon Effects",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const examples: { effect: IconEffect; icon: JSX.Element; label: string }[] = [
	{ effect: "bounce", icon: <ShieldCheckIcon />, label: "bounce" },
	{ effect: "pop", icon: <InfoCircleIcon />, label: "pop" },
	{ effect: "hop", icon: <HomeIcon />, label: "hop" },
	{ effect: "nudge", icon: <KeyIcon />, label: "nudge" },
	{ effect: "wiggle", icon: <PaletteIcon />, label: "wiggle" },
	{ effect: "spin", icon: <AddCircleIcon />, label: "spin" },
	{ effect: "tilt", icon: <BellIcon />, label: "tilt" },
	{ effect: "shake", icon: <DangerTriangleIcon />, label: "shake" },
	{ effect: "pulse", icon: <InfoCircleIcon />, label: "pulse" },
];

export const OnIconButtons: Story = {
	render: () => (
		<div class="flex flex-col gap-6">
			<p class="max-w-[60ch] text-sm text-muted-foreground">
				Any static Solar icon gets an effect with one prop on IconButton or
				Button (iconEffect), or with one class anywhere else. Hover with a mouse
				or press on touch.
			</p>
			<div class="flex flex-wrap gap-4">
				<For each={examples}>
					{(item) => (
						<div class="flex w-20 flex-col items-center gap-2">
							<IconButton
								size="xl"
								label={item.label}
								icon={item.icon}
								iconEffect={item.effect}
							/>
							<span class="text-xs text-muted-foreground">{item.label}</span>
						</div>
					)}
				</For>
			</div>
			<div class="flex flex-wrap gap-3">
				<Button variant="secondary" icon={<BellIcon />} iconEffect="tilt">
					Enable notifications
				</Button>
			</div>
		</div>
	),
};

export const OriginFix: Story = {
	render: () => (
		<div class="flex flex-col gap-4">
			<p class="max-w-[60ch] text-sm text-muted-foreground">
				Solar draws the settings gear at (12.5, 12). Without an origin it
				wobbles while spinning; with iconOrigin="12.5px 12px" it spins in place.
			</p>
			<div class="flex gap-6">
				<div class="flex w-28 flex-col items-center gap-2">
					<IconButton
						size="xl"
						label="Without origin fix"
						icon={<SettingsIcon />}
						iconEffect="spin"
					/>
					<span class="text-xs text-muted-foreground">default origin</span>
				</div>
				<div class="flex w-28 flex-col items-center gap-2">
					<IconButton
						size="xl"
						label="With origin fix"
						icon={<SettingsIcon />}
						iconEffect="spin"
						iconOrigin="12.5px 12px"
					/>
					<span class="text-xs text-muted-foreground">12.5px 12px</span>
				</div>
			</div>
		</div>
	),
};

export const SingleClass: Story = {
	render: () => {
		const gear = iconEffect({ effect: "spin", origin: "12.5px 12px" });
		return (
			<div class="flex items-center gap-4" data-icon-host="">
				<span class={gear.class} style={gear.style}>
					<SettingsIcon size={32} />
				</span>
				<span class="text-sm text-muted-foreground">
					A plain span with the class and origin, inside any data-icon-host.
				</span>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const host = canvasElement.querySelector("[data-icon-host]") as HTMLElement;
		const target = canvasElement.querySelector(".icon-fx") as HTMLElement;
		await userEvent.hover(host);
		await expect(target).toHaveAttribute("data-icon-fx-play");
		await waitFor(
			() => expect(target).not.toHaveAttribute("data-icon-fx-play"),
			{ timeout: 2000 },
		);
		await expect(within(canvasElement).getByText(/plain span/)).toBeVisible();
	},
};

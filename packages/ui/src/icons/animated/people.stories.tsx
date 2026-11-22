import { createSignal, For, type JSX } from "solid-js";
import { expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../../components/IconButton/IconButton";
import type { AnimatedIconHandle } from "./AnimatedIcon";
import {
	AnimatedCrownIcon,
	AnimatedEyeIcon,
	AnimatedHandShakeIcon,
	AnimatedHandStarsIcon,
	AnimatedLockIcon,
	AnimatedLoginIcon,
	AnimatedLogoutIcon,
	AnimatedProfileIcon,
	AnimatedSledgehammerIcon,
	AnimatedUserIcon,
	AnimatedUserMinusRoundedIcon,
	AnimatedUserSpeakIcon,
	AnimatedUsersGroupTwoRoundedIcon,
} from "./people";

const meta = {
	title: "Icons/People",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const icons: { label: string; icon: () => JSX.Element }[] = [
	{ label: "User", icon: () => <AnimatedUserIcon /> },
	{ label: "Profile", icon: () => <AnimatedProfileIcon /> },
	{ label: "Kick", icon: () => <AnimatedUserMinusRoundedIcon /> },
	{ label: "Members", icon: () => <AnimatedUsersGroupTwoRoundedIcon /> },
	{ label: "Language", icon: () => <AnimatedUserSpeakIcon /> },
	{ label: "Owner", icon: () => <AnimatedCrownIcon /> },
	{ label: "Ban", icon: () => <AnimatedSledgehammerIcon /> },
	{ label: "Handshake", icon: () => <AnimatedHandShakeIcon /> },
	{ label: "Hand with stars", icon: () => <AnimatedHandStarsIcon /> },
	{ label: "Log out", icon: () => <AnimatedLogoutIcon /> },
	{ label: "Log in", icon: () => <AnimatedLoginIcon /> },
	{ label: "Lock", icon: () => <AnimatedLockIcon /> },
	{ label: "Eye", icon: () => <AnimatedEyeIcon /> },
];

export const Gallery: Story = {
	render: () => (
		<div class="flex flex-wrap gap-4">
			<For each={icons}>
				{(item) => (
					<div class="flex w-24 flex-col items-center gap-2">
						<IconButton size="xl" label={item.label} icon={item.icon()} />
						<span class="text-center text-xs text-muted-foreground">
							{item.label}
						</span>
					</div>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll("[data-animated-icon]"),
		).toHaveLength(icons.length);
	},
};

export const EyeHidden: Story = {
	render: () => {
		const [hidden, setHidden] = createSignal(false);
		return (
			<IconButton
				size="xl"
				label={hidden() ? "Show" : "Hide"}
				aria-pressed={hidden()}
				onClick={() => setHidden(!hidden())}
				icon={<AnimatedEyeIcon hidden={hidden()} />}
			/>
		);
	},
};

export const LockToggle: Story = {
	render: () => {
		const [locked, setLocked] = createSignal(true);
		return (
			<IconButton
				size="xl"
				label={locked() ? "Unlock" : "Lock"}
				aria-pressed={locked()}
				onClick={() => setLocked(!locked())}
				icon={<AnimatedLockIcon locked={locked()} />}
			/>
		);
	},
};

export const ProfileNod: Story = {
	render: () => {
		let handle: AnimatedIconHandle | undefined;
		return (
			<IconButton
				size="xl"
				label="Profile"
				onClick={() => handle?.play()}
				icon={
					<AnimatedProfileIcon
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
			'[data-animated-icon="profile"]',
		);
		const head = icon?.querySelector('[data-part="head"]');
		canvasElement.querySelector("button")?.click();
		await waitFor(() =>
			expect(icon?.hasAttribute("data-attention")).toBe(true),
		);
		await expect(head?.getAnimations().length).toBeGreaterThan(0);
		await waitFor(
			() => expect(icon?.hasAttribute("data-attention")).toBe(false),
			{ timeout: 3000 },
		);
	},
};

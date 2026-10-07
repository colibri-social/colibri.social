import { createSignal, For } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { AnimatedSettingsIcon } from "../../icons/animated/icons";
import {
	AnimatedProfileIcon,
	AnimatedUsersGroupTwoRoundedIcon,
} from "../../icons/animated/people";
import { AnimatedInboxIcon } from "../../icons/animated/system";
import { type Haptics, HapticsProvider } from "../../utils/haptics";
import { Switch } from "../Switch/Switch";
import { TabBar, TabBarItem } from "./TabBar";

const meta = {
	title: "Navigation/Tab bar",
	component: TabBar,
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: {
		onChange: fn(),
	},
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const haptics = {
	impact: fn(),
	selection: fn(),
	notification: fn(),
} satisfies Haptics;

const MainTabs = (props: {
	onChange?: (value: string) => void;
	unread?: boolean;
	settingsBadge?: boolean;
}) => {
	const [tab, setTab] = createSignal("spaces");
	const [unread, setUnread] = createSignal(props.unread ?? true);
	const [settingsBadge, setSettingsBadge] = createSignal(
		props.settingsBadge ?? false,
	);

	return (
		<HapticsProvider haptics={haptics}>
			<div class="flex flex-col gap-4 pb-32">
				<Switch
					label="Unread in inbox"
					checked={unread()}
					onChange={setUnread}
				/>
				<Switch
					label="Settings badge"
					checked={settingsBadge()}
					onChange={setSettingsBadge}
				/>
				<For each={Array.from({ length: 24 }, (_, index) => index + 1)}>
					{(row) => (
						<div class="rounded-surface border border-border bg-card p-4 text-sm text-muted-foreground">
							Item {row} on the {tab()} tab
						</div>
					)}
				</For>
			</div>
			<TabBar
				value={tab()}
				onChange={(value) => {
					setTab(value);
					props.onChange?.(value);
				}}
			>
				<TabBarItem
					value="spaces"
					label="Spaces"
					icon={<AnimatedUsersGroupTwoRoundedIcon trigger="press" />}
				/>
				<TabBarItem
					value="inbox"
					label="Inbox"
					icon={<AnimatedInboxIcon trigger="press" unread={unread()} />}
				/>
				<TabBarItem
					value="profile"
					label="Profile"
					icon={<AnimatedProfileIcon trigger="press" />}
				/>
				<TabBarItem
					value="settings"
					label="Settings"
					icon={<AnimatedSettingsIcon trigger="press" />}
					badge={settingsBadge() ? "dot" : undefined}
				/>
			</TabBar>
		</HapticsProvider>
	);
};

export const Playground: Story = {
	render: (args) => <MainTabs onChange={args.onChange} />,
};

export const SelectTab: Story = {
	render: (args) => <MainTabs onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		haptics.selection.mockClear();
		const nav = within(canvasElement).getByRole("navigation", {
			name: "Main",
		});
		const spaces = within(nav).getByRole("button", { name: "Spaces" });
		const profile = within(nav).getByRole("button", { name: "Profile" });
		await expect(spaces).toHaveAttribute("aria-current", "page");

		await userEvent.click(profile);
		await expect(profile).toHaveAttribute("aria-current", "page");
		await expect(spaces).not.toHaveAttribute("aria-current");
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(args.onChange).toHaveBeenLastCalledWith("profile");
		await expect(haptics.selection).toHaveBeenCalledTimes(1);

		await userEvent.click(profile);
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(haptics.selection).toHaveBeenCalledTimes(1);
	},
};

export const KeyboardSelect: Story = {
	render: (args) => <MainTabs onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		const inbox = within(canvasElement).getByRole("button", {
			name: "Inbox",
		});
		inbox.focus();
		await userEvent.keyboard("{Enter}");
		await expect(inbox).toHaveAttribute("aria-current", "page");
		await expect(args.onChange).toHaveBeenCalledWith("inbox");
	},
};

export const DotBadge: Story = {
	render: () => <MainTabs settingsBadge />,
	play: async ({ canvasElement }) => {
		const settings = within(canvasElement).getByRole("button", {
			name: /^Settings\b.*new activity/,
		});
		await expect(
			settings.querySelector('[data-tab-bar-badge="dot"]'),
		).toBeInTheDocument();

		await userEvent.click(
			within(canvasElement).getByRole("switch", { name: "Settings badge" }),
		);
		await expect(
			canvasElement.querySelector('[data-tab-bar-badge="dot"]'),
		).not.toBeInTheDocument();
	},
};

export const FromItems: Story = {
	args: {
		defaultValue: "inbox",
		items: [
			{
				value: "spaces",
				label: "Spaces",
				icon: <AnimatedUsersGroupTwoRoundedIcon trigger="press" />,
			},
			{
				value: "inbox",
				label: "Inbox",
				icon: <AnimatedInboxIcon trigger="press" unread />,
			},
			{
				value: "profile",
				label: "Profile",
				icon: <AnimatedProfileIcon trigger="press" />,
			},
			{
				value: "settings",
				label: "Settings",
				icon: <AnimatedSettingsIcon trigger="press" />,
				badge: "dot",
			},
		],
	},
};

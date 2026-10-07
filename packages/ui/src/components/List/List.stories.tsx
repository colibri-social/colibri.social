import { AccessibilityIcon } from "@solar-icons/solid/bold/accessibility";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { CrownIcon } from "@solar-icons/solid/bold/crown";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { ShareIcon } from "@solar-icons/solid/bold/share";
import { ShieldCheckIcon } from "@solar-icons/solid/bold/shield-check";
import { createSignal, For } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Avatar } from "../Avatar/Avatar";
import {
	CheckboxRow,
	DestructiveRow,
	ListGroup,
	NavRow,
	RadioRow,
	RadioRowGroup,
	SidebarNav,
	SidebarNavItem,
	SidebarNavSection,
	ToggleRow,
} from "./List";

const meta = {
	title: "Navigation/List",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = {
	render: () => (
		<div class="flex w-full max-w-sm flex-col gap-6">
			<ListGroup label="Community">
				<NavRow icon={<SettingsIcon />} label="Overview" />
				<NavRow icon={<ShieldCheckIcon />} label="Roles" value="6 roles" />
				<NavRow
					icon={<BellIcon />}
					label="Notifications"
					value="Mentions only"
				/>
			</ListGroup>
			<ListGroup label="Support">
				<NavRow
					icon={<ChatRoundDotsIcon />}
					label="Send feedback"
					href="https://colibri.social"
					external
				/>
				<NavRow icon={<ShareIcon />} label="Share invite link" />
			</ListGroup>
			<ListGroup>
				<DestructiveRow label="Leave community" />
			</ListGroup>
		</div>
	),
};

export const Toggles: Story = {
	render: () => (
		<div class="w-full max-w-sm">
			<ListGroup label="Privacy">
				<ToggleRow
					title="Private channel"
					description="Only selected members and roles can view this channel."
				/>
				<ToggleRow
					title="Stay in sync with Bluesky"
					description="Updates to your Bluesky profile will be mirrored to your Colibri profile."
					defaultChecked
				/>
				<ToggleRow title="Show read receipts" disabled />
			</ListGroup>
		</div>
	),
};

export const ToggleRowTextClick: Story = {
	render: () => (
		<div class="w-full max-w-sm">
			<ListGroup>
				<ToggleRow
					title="Private channel"
					description="Only selected members can view this channel."
				/>
			</ListGroup>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("switch");
		await userEvent.click(canvas.getByText("Private channel"));
		await expect(input).toBeChecked();
		await userEvent.click(
			canvas.getByText("Only selected members can view this channel."),
		);
		await expect(input).not.toBeChecked();
		const row = canvas.getByText("Private channel").closest(".px-3");
		await userEvent.click(row as HTMLElement);
		await expect(input).toBeChecked();
	},
};

export const ToggleRowCallsOnChangeOnce: Story = {
	render: () => {
		const [calls, setCalls] = createSignal<boolean[]>([]);
		return (
			<div class="w-full max-w-sm">
				<ListGroup>
					<ToggleRow
						title="Private channel"
						onChange={(checked) => setCalls((list) => [...list, checked])}
					/>
				</ListGroup>
				<output data-testid="calls">{calls().join(",")}</output>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByText("Private channel"));
		await waitFor(() =>
			expect(canvas.getByTestId("calls")).toHaveTextContent(/^true$/),
		);
		await userEvent.click(
			canvas.getByText("Private channel").closest(".px-3") as HTMLElement,
		);
		await waitFor(() =>
			expect(canvas.getByTestId("calls")).toHaveTextContent(/^true,false$/),
		);
	},
};

const channelTypes = [
	{
		value: "text",
		title: "Text",
		description: "Send messages, images, and links.",
		icon: <ChatRoundDotsIcon />,
	},
	{
		value: "voice",
		title: "Voice",
		description: "Talk together with voice and video.",
		icon: <BellIcon />,
	},
];

export const Radios: Story = {
	render: () => (
		<div class="w-full max-w-sm">
			<RadioRowGroup label="Channel type" defaultValue="text">
				<For each={channelTypes}>
					{(type) => (
						<RadioRow
							value={type.value}
							title={type.title}
							description={type.description}
							icon={type.icon}
						/>
					)}
				</For>
			</RadioRowGroup>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const voice = canvas.getByRole("radio", { name: /Voice/ });
		await expect(voice).not.toBeChecked();
		await userEvent.click(
			canvas.getByText("Talk together with voice and video."),
		);
		await expect(voice).toBeChecked();
		const textRow = canvas.getByText("Text").closest(".px-3") as HTMLElement;
		await userEvent.click(textRow);
		await expect(canvas.getByRole("radio", { name: /Text/ })).toBeChecked();
	},
};

const members = [
	{ name: "Ada Lovelace", handle: "ada.bsky.social" },
	{ name: "Grace Hopper", handle: "grace.bsky.social" },
	{ name: "Alan Turing", handle: "alan.bsky.social" },
];

export const Checkboxes: Story = {
	render: () => (
		<div class="w-full max-w-sm">
			<ListGroup label="Members" count={members.length}>
				<For each={members}>
					{(member) => (
						<CheckboxRow
							label={member.name}
							value={member.handle}
							leading={<Avatar name={member.name} size="md" />}
						/>
					)}
				</For>
			</ListGroup>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const ada = canvas.getByRole("checkbox", { name: /Ada Lovelace/ });
		const row = ada.closest(".px-3") as HTMLElement;
		await userEvent.click(row);
		await expect(ada).toBeChecked();
		await userEvent.click(row.querySelector("label") as HTMLElement);
		await expect(ada).not.toBeChecked();
		await userEvent.click((ada.nextElementSibling as HTMLElement) ?? row);
		await expect(ada).toBeChecked();
	},
};

const sections = [
	{
		label: "Community",
		items: [
			{ id: "overview", label: "Overview", icon: <SettingsIcon /> },
			{ id: "roles", label: "Roles", icon: <ShieldCheckIcon /> },
			{ id: "boosts", label: "Boosts", icon: <CrownIcon /> },
		],
	},
	{
		label: "App",
		items: [
			{ id: "notifications", label: "Notifications", icon: <BellIcon /> },
			{
				id: "accessibility",
				label: "Accessibility",
				icon: <AccessibilityIcon />,
			},
		],
	},
];

export const Sidebar: Story = {
	render: () => {
		const [active, setActive] = createSignal("overview");
		return (
			<div class="w-64 rounded-surface bg-card p-4">
				<SidebarNav aria-label="Settings">
					<For each={sections}>
						{(section) => (
							<SidebarNavSection label={section.label}>
								<For each={section.items}>
									{(item) => (
										<SidebarNavItem
											label={item.label}
											icon={item.icon}
											active={active() === item.id}
											onClick={() => setActive(item.id)}
										/>
									)}
								</For>
							</SidebarNavSection>
						)}
					</For>
					<SidebarNavSection>
						<SidebarNavItem
							label="Help center"
							icon={<ChatRoundDotsIcon />}
							href="https://colibri.social"
							external
						/>
					</SidebarNavSection>
					<SidebarNavSection>
						<SidebarNavItem
							label="Log out"
							icon={<Logout2Icon />}
							tone="destructive"
						/>
					</SidebarNavSection>
				</SidebarNav>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const overview = canvas.getByRole("button", { name: "Overview" });
		const roles = canvas.getByRole("button", { name: "Roles" });
		await expect(overview).toHaveAttribute("aria-current", "page");
		await expect(roles).not.toHaveAttribute("aria-current");
		await userEvent.click(roles);
		await expect(roles).toHaveAttribute("aria-current", "page");
		await expect(overview).not.toHaveAttribute("aria-current");
	},
};

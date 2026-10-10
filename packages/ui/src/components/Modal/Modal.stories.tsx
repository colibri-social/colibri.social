import { AccessibilityIcon } from "@solar-icons/solid/bold/accessibility";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { createSignal, For, type JSX, Show } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	hasIntermediate,
	recordHeightTransitions,
	sampleHeights,
	withSlowMotion,
} from "../../foundations/motion-test";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { DropdownMenu } from "../DropdownMenu/DropdownMenu";
import { SidebarNavItem, SidebarNavSection } from "../List/List";
import { SpaceCard } from "../Space/SpaceCard";
import { StatusField } from "../StatusField/StatusField";
import { SearchField, TextField } from "../TextField/TextField";
import { LargeModalContent, Modal, ModalContent, ModalTrigger } from "./Modal";

const meta = {
	title: "Overlays/Modal",
	component: Modal,
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Open modal</ModalTrigger>
			<ModalContent title="Modal title" footer={<Button>Button</Button>} />
		</Modal>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open modal" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Modal title" });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Close" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const MenuInsideModal: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Open modal</ModalTrigger>
			<ModalContent title="Channel options">
				<DropdownMenu
					label="More options"
					trigger="More options"
					triggerAs={Button}
					items={[{ label: "Rename" }, { label: "Duplicate" }]}
				/>
			</ModalContent>
		</Modal>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open modal" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Channel options",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "More options" }),
		);
		const menu = await screen.findByRole("menu", {}, { timeout: 3000 });
		await waitFor(() =>
			expect(menu.closest("[aria-hidden='true']")).toBeNull(),
		);
		await expect(
			within(menu).getByRole("menuitem", { name: "Rename" }),
		).toBeInTheDocument();
	},
};

export const SmallOnMobile: Story = {
	...Small,
	parameters: { viewport: { defaultViewport: "iphone" } },
	play: undefined,
};

export const ShortForm: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Set status</ModalTrigger>
			<ModalContent title="Set your status" footer={<Button>Save</Button>}>
				<StatusField defaultValue={{ text: "Building a nest!", emoji: "🐦" }} />
			</ModalContent>
		</Modal>
	),
};

export const Confirmation: Story = {
	render: () => (
		<Modal>
			<ModalTrigger as={Button} variant="destructive">
				Delete Space
			</ModalTrigger>
			<ModalContent
				title="Delete Awesome Space?"
				description="Everything in this Space is removed for every member. This cannot be undone."
				footer={
					<>
						<Button variant="secondary">Cancel</Button>
						<Button variant="destructive">Delete Space</Button>
					</>
				}
			/>
		</Modal>
	),
};

const sections: {
	title: string;
	items: { icon: () => JSX.Element; label: string }[];
}[] = [
	{
		title: "Account",
		items: [{ icon: () => <UserIdIcon />, label: "Profile" }],
	},
	{
		title: "App settings",
		items: [
			{ icon: () => <PaletteIcon />, label: "Appearance" },
			{ icon: () => <AccessibilityIcon />, label: "Accessibility" },
			{ icon: () => <BellIcon />, label: "Notifications" },
		],
	},
];

const SettingsSidebar = (props: {
	active: string;
	onSelect: (label: string) => void;
}) => (
	<For each={sections}>
		{(section) => (
			<SidebarNavSection label={section.title}>
				<For each={section.items}>
					{(item) => (
						<SidebarNavItem
							icon={item.icon()}
							label={item.label}
							active={props.active === item.label}
							onClick={() => props.onSelect(item.label)}
						/>
					)}
				</For>
			</SidebarNavSection>
		)}
	</For>
);

export const Large: Story = {
	render: () => {
		const [active, setActive] = createSignal("Profile");
		return (
			<Modal>
				<ModalTrigger as={Button}>Open settings</ModalTrigger>
				<LargeModalContent
					title={active()}
					sidebar={<SettingsSidebar active={active()} onSelect={setActive} />}
				>
					<p class="text-sm text-muted-foreground">
						{active()} settings go here.
					</p>
				</LargeModalContent>
			</Modal>
		);
	},
};

const discoverySpaces = () => [
	{
		name: "Colibri Social Flock",
		iconSrc: storyImages.violetIcon(),
		bannerSrc: storyImages.sunsetBanner(),
		memberCount: 180,
		description:
			"A cozy corner for people who build things on the AT Protocol.",
	},
	{
		name: "Pixel Garden",
		iconSrc: storyImages.tealIcon(),
		memberCount: 1,
		description: "Pixel art, palettes, and weekly prompts.",
	},
	{
		name: "Night Owls",
		memberCount: 12480,
		bannerColor: "linear-gradient(135deg, #1e3a8a, #0f172a)",
		description: "Late night chats, music, and co-working in voice.",
	},
	{
		name: "Trail Runners",
		memberCount: 342,
		bannerColor: "linear-gradient(135deg, #166534, #052e16)",
		description: "Routes, races, and recovery tips.",
	},
];

const CommunityDiscovery = () => {
	const [query, setQuery] = createSignal("");
	const results = () =>
		discoverySpaces().filter((space) =>
			space.name.toLowerCase().includes(query().trim().toLowerCase()),
		);
	return (
		<Modal>
			<ModalTrigger as={Button}>Discover Spaces</ModalTrigger>
			<LargeModalContent title="Discover Spaces">
				<div class="flex flex-col gap-4">
					<SearchField
						placeholder="Search Spaces"
						aria-label="Search Spaces"
						value={query()}
						onChange={setQuery}
					/>
					<div
						data-discovery-grid=""
						class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
					>
						<For each={results()}>{(space) => <SpaceCard {...space} />}</For>
					</div>
					<Show when={results().length === 0}>
						<p class="text-sm text-muted-foreground">No Spaces found.</p>
					</Show>
				</div>
			</LargeModalContent>
		</Modal>
	);
};

export const WithoutSidebar: Story = {
	name: "Without sidebar",
	render: () => <CommunityDiscovery />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Discover Spaces" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Discover Spaces",
		});
		await expect(dialog.querySelector("nav")).toBeNull();
		const main = dialog.querySelector("[data-modal-main]") as HTMLElement;
		await waitFor(() =>
			expect(main.getBoundingClientRect().width).toBeCloseTo(
				dialog.clientWidth,
				0,
			),
		);
		const grid = dialog.querySelector("[data-discovery-grid]") as HTMLElement;
		await expect(grid.children).toHaveLength(4);
		await userEvent.type(
			within(dialog).getByRole("searchbox", { name: "Search Spaces" }),
			"pixel",
		);
		await waitFor(() => expect(grid.children).toHaveLength(1));
		await expect(within(grid).getByText("Pixel Garden")).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Close" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const WithoutSidebarOnMobile: Story = {
	...WithoutSidebar,
	name: "Without sidebar on mobile",
	parameters: { viewport: { defaultViewport: "iphone" } },
	play: undefined,
};

const GrowingModal = () => {
	const [expanded, setExpanded] = createSignal(false);
	return (
		<Modal>
			<ModalTrigger as={Button}>Open growing modal</ModalTrigger>
			<ModalContent
				title="Invite people"
				footer={
					<Button
						variant="secondary"
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded() ? "Fewer options" : "More options"}
					</Button>
				}
			>
				<TextField label="Invite link" defaultValue="colibri.social/i/nest" />
				<Show when={expanded()}>
					<TextField label="Expires after" defaultValue="7 days" />
					<TextField label="Maximum uses" defaultValue="No limit" />
				</Show>
			</ModalContent>
		</Modal>
	);
};

export const AnimatesHeight: Story = {
	render: () => <GrowingModal />,
	play: async ({ canvasElement }) => {
		const opening = recordHeightTransitions();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open growing modal" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Invite people" });
		await new Promise((resolve) => setTimeout(resolve, 500));
		opening.stop();
		await expect(opening.count()).toBe(0);
		const before = dialog.offsetHeight;
		await withSlowMotion(async () => {
			const sampling = sampleHeights(dialog, 700);
			await userEvent.click(
				within(dialog).getByRole("button", { name: "More options" }),
			);
			const samples = await sampling;
			await waitFor(() => expect(dialog.style.height).toBe(""), {
				timeout: 4000,
			});
			const after = dialog.offsetHeight;
			await expect(after).toBeGreaterThan(before + 100);
			await expect(hasIntermediate(samples, before, after)).toBe(true);
		});
	},
};

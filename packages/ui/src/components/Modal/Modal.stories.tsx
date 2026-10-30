import { AccessibilityIcon } from "@solar-icons/solid/bold/accessibility";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { createSignal, For, type JSX, Show } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
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
import { UnsavedChangesBar } from "../UnsavedChangesBar/UnsavedChangesBar";
import {
	LargeModalContent,
	Modal,
	ModalClose,
	ModalContent,
	ModalTrigger,
} from "./Modal";

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
		if (window.innerWidth >= 768) {
			await waitFor(() =>
				expect(dialog.getBoundingClientRect().width).toBe(440),
			);
		}
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

export const KeyboardMenuInLargeModal: Story = {
	name: "Keyboard menu in large modal",
	render: () => (
		<Modal>
			<ModalTrigger as={Button}>Open settings</ModalTrigger>
			<LargeModalContent title="Roles">
				<div class="flex flex-col gap-4">
					<For each={Array.from({ length: 30 }, (_, index) => index)}>
						{(index) => (
							<p class="m-0 text-sm text-muted-foreground">Row {index + 1}</p>
						)}
					</For>
					<DropdownMenu
						label="Role options"
						trigger="Role options"
						triggerAs={Button}
						items={[{ label: "Rename" }, { label: "Delete" }]}
					/>
				</div>
			</LargeModalContent>
		</Modal>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open settings" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Roles" });
		const trigger = within(dialog).getByRole("button", {
			name: "Role options",
		});
		trigger.focus();
		await userEvent.keyboard("{Enter}");
		const menu = await screen.findByRole("menu", {}, { timeout: 3000 });
		await waitFor(() =>
			expect(
				within(menu).getByRole("menuitem", { name: "Rename" }),
			).toHaveFocus(),
		);
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

export const LargeWithUnsavedChanges: Story = {
	name: "Large with unsaved changes",
	render: () => {
		const [name, setName] = createSignal("Colibri HQ");
		const dirty = () => name() !== "Colibri HQ";
		return (
			<Modal defaultOpen>
				<LargeModalContent
					title="Roles"
					sidebar={<SettingsSidebar active="Profile" onSelect={() => {}} />}
					actions={<Button class="h-8 px-3">New role</Button>}
				>
					<div class="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6">
						<TextField label="Name" value={name()} onChange={setName} />
						<For each={Array.from({ length: 12 }, (_, index) => index)}>
							{(index) => <TextField label={`Field ${index + 1}`} value="" />}
						</For>
						<TextField label="Last field" value="" />
						<UnsavedChangesBar
							visible={dirty()}
							onCancel={() => setName("Colibri HQ")}
							onSave={() => {}}
						/>
					</div>
				</LargeModalContent>
			</Modal>
		);
	},
	play: async () => {
		const dialog = await screen.findByRole("dialog", { name: "Roles" });
		const actions = dialog.querySelector<HTMLElement>("[data-modal-actions]");
		expect(actions).not.toBeNull();
		await waitFor(() =>
			expect(
				within(actions as HTMLElement).getByRole("button", {
					name: "New role",
				}),
			).toBeVisible(),
		);
		await userEvent.type(within(dialog).getByLabelText("Name"), "!");
		const bar = dialog.querySelector<HTMLElement>("[data-unsaved-changes-bar]");
		await waitFor(() => expect(bar?.dataset.visible).toBeDefined());
		const scroll = dialog.querySelector<HTMLElement>("[data-modal-scroll]");
		if (scroll) scroll.scrollTop = scroll.scrollHeight;
		await waitFor(() => {
			const last = within(dialog)
				.getByLabelText("Last field")
				.getBoundingClientRect();
			const card = bar?.getBoundingClientRect();
			expect(card && last.bottom <= card.top + 0.5).toBe(true);
		});
		await expectNoLayoutIssues(dialog);
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

const rolePages = ["Roles", "Moderators", "Permissions"] as const;

export const NestedPages: Story = {
	name: "Nested pages",
	render: () => {
		const [depth, setDepth] = createSignal(1);
		const trail = () =>
			rolePages.slice(0, depth() - 1).map((label, index) => ({
				label,
				onSelect: () => setDepth(index + 1),
			}));
		return (
			<Modal>
				<ModalTrigger as={Button}>Open Space settings</ModalTrigger>
				<LargeModalContent
					title={rolePages[depth() - 1]}
					trail={trail()}
					onBack={depth() > 1 ? () => setDepth(depth() - 1) : undefined}
					sidebar={<SettingsSidebar active="Profile" onSelect={() => {}} />}
				>
					<Show
						when={depth() < rolePages.length}
						fallback={
							<p class="text-sm text-muted-foreground">
								Permissions for Moderators go here.
							</p>
						}
					>
						<Button onClick={() => setDepth(depth() + 1)}>
							Open {rolePages[depth()]}
						</Button>
					</Show>
				</LargeModalContent>
			</Modal>
		);
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Open Space settings",
			}),
		);
		const dialog = await screen.findByRole("dialog", { name: "Roles" });
		await expect(
			within(dialog).queryByRole("navigation", { name: "Breadcrumb" }),
		).toBeNull();
		await expect(
			within(dialog).queryByRole("button", { name: "Back" }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Open Moderators" }),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Open Permissions" }),
		);
		const crumbs = within(dialog).getByRole("navigation", {
			name: "Breadcrumb",
		});
		await expect(
			Array.from(crumbs.querySelectorAll("li")).map((item) =>
				item.textContent?.replace("/", "").trim(),
			),
		).toEqual(["Roles", "Moderators", "Permissions"]);
		await expect(within(crumbs).getByText("Permissions")).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expectNoLayoutIssues(dialog);
		await userEvent.click(within(dialog).getByRole("button", { name: "Back" }));
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Open Permissions" }),
			).toBeInTheDocument(),
		);
		await userEvent.click(
			within(crumbs).getByRole("button", { name: "Roles" }),
		);
		await waitFor(() =>
			expect(
				within(dialog).queryByRole("navigation", { name: "Breadcrumb" }),
			).toBeNull(),
		);
		await expect(
			within(dialog).queryByRole("button", { name: "Back" }),
		).toBeNull();
	},
};

export const UnsavedChanges: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		const [name, setName] = createSignal("Moderators");
		return (
			<>
				<Button onClick={() => setOpen(true)}>Edit role</Button>
				<Modal
					open={open()}
					onOpenChange={setOpen}
					dirty={name() !== "Moderators"}
				>
					<ModalContent
						title="Edit role"
						footer={
							<>
								<ModalClose>Cancel</ModalClose>
								<Button>Save</Button>
							</>
						}
					>
						<TextField label="Name" value={name()} onChange={setName} />
					</ModalContent>
				</Modal>
			</>
		);
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Edit role" }),
		);
		await screen.findByRole("dialog", { name: "Edit role" });
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);

		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Edit role" }),
		);
		const reopened = await screen.findByRole("dialog", { name: "Edit role" });
		await userEvent.type(within(reopened).getByLabelText("Name"), "!");
		const ask = async () =>
			screen.findByRole(
				"dialog",
				{ name: "Discard changes?" },
				{ timeout: 3000 },
			);

		await userEvent.keyboard("{Escape}");
		let prompt = await ask();
		await userEvent.click(
			within(prompt).getByRole("button", { name: "Cancel" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Discard changes?" }),
			).not.toBeInTheDocument(),
		);
		await expect(reopened).toBeInTheDocument();

		await userEvent.click(
			await waitFor(
				() => within(reopened).getByRole("button", { name: "Cancel" }),
				{ timeout: 3000 },
			),
		);
		prompt = await ask();
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Discard changes?" }),
			).not.toBeInTheDocument(),
		);
		await expect(reopened).toBeInTheDocument();

		const overlay = document.querySelector<HTMLElement>(".bg-overlay");
		if (overlay) {
			await userEvent.click(overlay);
			prompt = await ask();
			await userEvent.click(
				within(prompt).getByRole("button", { name: "Cancel" }),
			);
			await waitFor(() =>
				expect(
					screen.queryByRole("dialog", { name: "Discard changes?" }),
				).not.toBeInTheDocument(),
			);
		}

		const close = await waitFor(
			() => within(reopened).getByRole("button", { name: "Close" }),
			{ timeout: 3000 },
		);
		await userEvent.click(close);
		prompt = await ask();
		await waitFor(() => expectNoLayoutIssues(prompt), { timeout: 3000 });
		await userEvent.click(
			within(prompt).getByRole("button", { name: "Discard changes" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

const ComposerWithModal = () => {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="flex flex-col gap-3 p-4">
			<TextField label="Message" placeholder="Message #general" />
			<Button onClick={() => setOpen(true)}>Delete message</Button>
			<Modal open={open()} onOpenChange={setOpen}>
				<ModalContent
					title="Delete message?"
					description="This can't be undone."
					footer={
						<>
							<ModalClose>Cancel</ModalClose>
							<Button variant="destructive">Delete</Button>
						</>
					}
				/>
			</Modal>
		</div>
	);
};

const openFrom = (button: HTMLElement, pointerType: "touch" | "mouse") => {
	button.dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			pointerType,
			isPrimary: true,
		}),
	);
	button.click();
};

export const DismissesKeyboardOnTouch: Story = {
	render: () => <ComposerWithModal />,
	parameters: { viewport: { defaultViewport: "iphone" } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole("textbox", { name: "Message" });
		field.focus();
		openFrom(canvas.getByRole("button", { name: "Delete message" }), "touch");
		await expect(document.activeElement).not.toBe(field);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete message?",
		});
		await expectNoLayoutIssues(dialog);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await expect(document.activeElement).not.toBe(field);
	},
};

export const KeepsFocusForMouse: Story = {
	render: () => <ComposerWithModal />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole("textbox", { name: "Message" });
		field.focus();
		openFrom(canvas.getByRole("button", { name: "Delete message" }), "mouse");
		await expect(document.activeElement).toBe(field);
		const dialog = await screen.findByRole("dialog", {
			name: "Delete message?",
		});
		await expectNoLayoutIssues(dialog);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

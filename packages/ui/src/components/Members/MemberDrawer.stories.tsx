import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { FALLBACK_BADGE_DEFINITIONS, UserBadge } from "../Badge/Badge";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import type { MemberMenuRole } from "../ContextMenu/MemberMenu";
import { MessageRow } from "../Message/MessageRow";
import { ChipButton } from "../RichText/ChipButton";
import { MemberActionDialog } from "./MemberActionDialog";
import { MemberDrawer, type MemberDrawerProps } from "./MemberDrawer";
import { MemberRow } from "./MemberRow";

const meta = {
	title: "Navigation/Member drawer",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const spy = {
	viewProfile: fn(),
	roleChange: fn(),
	kick: fn(),
	ban: fn(),
	copyDid: fn(),
	authorClick: fn(),
	authorMenu: fn(),
	rowOpen: fn(),
	rowMenu: fn(),
	chipClick: fn(),
	chipMenu: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

const LONG_NAME =
	"Bartholomew Featherstonehaugh-Wrigglesworth the Third of the Northern Marsh";
const LONG_HANDLE =
	"bartholomew-featherstonehaugh-wrigglesworth.northern-marsh.birdwatchers.example";

const initialRoles = (): MemberMenuRole[] => [
	{
		id: "mods",
		name: "Moderators",
		color: "#c4a7ff",
		assigned: true,
		manageable: true,
	},
	{
		id: "artists",
		name: "Artists",
		color: "#ffd857",
		assigned: false,
		manageable: true,
	},
	{
		id: "night",
		name: "Night owls who stay up far too late sketching birds by lamplight",
		color: "#76c4e5",
		assigned: true,
		manageable: true,
	},
	{
		id: "admins",
		name: "Admins",
		color: "#ff7a7a",
		assigned: false,
		manageable: false,
	},
];

const afterDrawerClosed = () =>
	new Promise<void>((resolve) => {
		const check = () => {
			if (!document.querySelector('[role="dialog"]')) {
				requestAnimationFrame(() => resolve());
				return;
			}
			setTimeout(check, 50);
		};
		check();
	});

type DemoProps = {
	moderator?: boolean;
	name?: string;
	handle?: string;
	badge?: boolean;
};

const STORY_BADGE = FALLBACK_BADGE_DEFINITIONS[0];

const MemberDrawerDemo = (props: DemoProps) => {
	const [open, setOpen] = createSignal(false);
	const [roles, setRoles] = createSignal(initialRoles());
	const [action, setAction] = createSignal<"kick" | "ban">("kick");
	const [actionOpen, setActionOpen] = createSignal(false);
	const name = () => props.name ?? "Lis";
	const moderation = (): Partial<MemberDrawerProps> =>
		props.moderator
			? {
					roles: roles(),
					onRoleChange: (id, assigned) => {
						spy.roleChange(id, assigned);
						setRoles((current) =>
							current.map((role) =>
								role.id === id ? { ...role, assigned } : role,
							),
						);
					},
					onKick: () => {
						spy.kick();
						setAction("kick");
						void afterDrawerClosed().then(() => setActionOpen(true));
					},
					onBan: () => {
						spy.ban();
						setAction("ban");
						void afterDrawerClosed().then(() => setActionOpen(true));
					},
				}
			: {};
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold member
			</Button>
			<MemberDrawer
				open={open()}
				onOpenChange={setOpen}
				name={name()}
				handle={props.handle ?? "lis.colibri.social"}
				avatarSrc={storyImages.tealIcon()}
				avatarSeed="did:plc:lis"
				badge={
					props.badge && STORY_BADGE ? (
						<UserBadge definition={STORY_BADGE} size="sm" />
					) : undefined
				}
				onViewProfile={spy.viewProfile}
				onCopyDid={spy.copyDid}
				developerMode
				developer={{
					copyLabel: "Copy DID",
					copyValue: "did:plc:lisdrawspixelbirds2b4d6f8h",
					pdslsHref:
						"https://pdsls.dev/at://did:plc:lisdrawspixelbirds2b4d6f8h",
				}}
				{...moderation()}
			/>
			<MemberActionDialog
				open={actionOpen()}
				onOpenChange={setActionOpen}
				kind={action()}
				name={name()}
				onConfirm={() => new Promise((resolve) => setTimeout(resolve, 200))}
			/>
		</div>
	);
};

const openDrawer = async (canvasElement: HTMLElement, name: string) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Hold member" }),
	);
	const dialog = await screen.findByRole("dialog", { name: `${name} options` });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	return dialog;
};

const waitForDrawerClosed = (name: string) =>
	waitFor(
		() =>
			expect(
				screen.queryByRole("dialog", { name: `${name} options` }),
			).toBeNull(),
		{ timeout: 3000 },
	);

const expectHeaderInset = async (dialog: HTMLElement) => {
	const header = dialog.querySelector(
		"[data-member-drawer-header]",
	) as HTMLElement;
	await expect(
		Math.round(
			header.getBoundingClientRect().left - dialog.getBoundingClientRect().left,
		),
	).toBe(16);
};

export const Default: Story = {
	render: () => <MemberDrawerDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Lis");
		await expectNoLayoutIssues(dialog);
		await expectHeaderInset(dialog);
		await expect(within(dialog).getByText("@lis.colibri.social")).toBeVisible();
		await expect(
			within(dialog).queryByRole("button", { name: /Roles/ }),
		).toBeNull();
		await expect(
			within(dialog).queryByRole("button", { name: /^Kick/ }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "View profile" }),
		);
		await expect(spy.viewProfile).toHaveBeenCalledTimes(1);
		await waitForDrawerClosed("Lis");
	},
};

export const Moderator: Story = {
	render: () => <MemberDrawerDemo moderator />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Lis");
		await expectNoLayoutIssues(dialog);
		for (const row of ["View profile", "Kick Lis", "Ban Lis"]) {
			const button = within(dialog).getByRole("button", { name: row });
			await expect(button.querySelector("svg")).not.toBeNull();
		}
		await expect(
			within(dialog).getAllByRole("button", { name: "Copy DID" }),
		).toHaveLength(1);
		const roles = within(dialog).getByRole("button", { name: /^Roles/ });
		await expect(roles).toHaveTextContent("2");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Kick Lis" }),
		);
		await expect(spy.kick).toHaveBeenCalledTimes(1);
		await waitForDrawerClosed("Lis");
		const confirm = await screen.findByRole("dialog", {
			name: "Kick Lis from this Space?",
		});
		await waitFor(() => expect(confirm).toBeVisible());
		await expectNoLayoutIssues(confirm);
		const kick = within(confirm).getByRole("button", { name: "Kick" });
		await userEvent.click(kick);
		await waitFor(() => expect(kick).toHaveAttribute("aria-busy", "true"));
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: "Kick Lis from this Space?" }),
				).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

export const RoleView: Story = {
	render: () => <MemberDrawerDemo moderator />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Lis");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^Roles/ }),
		);
		const back = await within(dialog).findByRole("button", {
			name: "Back to member options",
		});
		await expect(back).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expectNoLayoutIssues(dialog);
		await expectHeaderInset(dialog);
		const artists = within(dialog).getByRole("checkbox", { name: "Artists" });
		await expect(artists).not.toBeChecked();
		await userEvent.click(artists);
		await expect(spy.roleChange).toHaveBeenCalledWith("artists", true);
		await waitFor(() => expect(artists).toBeChecked());
		await expect(
			within(dialog).getByRole("checkbox", { name: "Artists" }),
		).toBe(artists);
		await expect(screen.getByRole("dialog", { name: "Lis options" })).toBe(
			dialog,
		);
		await expect(
			within(dialog).getByRole("checkbox", { name: "Admins" }),
		).toBeDisabled();

		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "View profile" }),
			).toBeVisible(),
		);
		await expect(screen.getByRole("dialog", { name: "Lis options" })).toBe(
			dialog,
		);
		await expect(
			within(dialog).getByRole("button", { name: /^Roles/ }),
		).toHaveTextContent("3");

		await userEvent.click(
			within(dialog).getByRole("button", { name: /^Roles/ }),
		);
		await within(dialog).findByRole("button", {
			name: "Back to member options",
		});
		await userEvent.keyboard("{Escape}");
		await userEvent.keyboard("{Escape}");
		await waitForDrawerClosed("Lis");

		const reopened = await openDrawer(canvasElement, "Lis");
		await expect(
			within(reopened).getByRole("button", { name: "View profile" }),
		).toBeVisible();
		await expect(
			within(reopened).queryByRole("button", {
				name: "Back to member options",
			}),
		).toBeNull();
	},
};

export const LongNameAndHandle: Story = {
	render: () => (
		<MemberDrawerDemo moderator name={LONG_NAME} handle={LONG_HANDLE} />
	),
	play: async ({ canvasElement }) => {
		const dialog = await openDrawer(canvasElement, LONG_NAME);
		await expectNoLayoutIssues(dialog);
		await expectHeaderInset(dialog);
		const kick = within(dialog).getByRole("button", {
			name: `Kick ${LONG_NAME}`,
		});
		await expect(kick.getBoundingClientRect().right).toBeLessThanOrEqual(
			dialog.getBoundingClientRect().right,
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^Roles/ }),
		);
		await within(dialog).findByRole("button", {
			name: "Back to member options",
		});
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expectNoLayoutIssues(dialog);
	},
};

export const WithBadge: Story = {
	render: () => (
		<MemberDrawerDemo badge name={LONG_NAME} handle={LONG_HANDLE} />
	),
	play: async ({ canvasElement }) => {
		const dialog = await openDrawer(canvasElement, LONG_NAME);
		await expectNoLayoutIssues(dialog);
		const header = dialog.querySelector(
			"[data-member-drawer-header]",
		) as HTMLElement;
		const badge = header.querySelector(
			"[data-member-drawer-badge]",
		) as HTMLElement;
		await expect(badge).toBeVisible();
		await expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(
			header.getBoundingClientRect().right,
		);
	},
};

const touch = (type: string, target: Element, x: number, y: number) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType: "touch",
			pointerId: 1,
			isPrimary: true,
			clientX: x,
			clientY: y,
		}),
	);

const longPress = async (target: Element) => {
	const rect = target.getBoundingClientRect();
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;
	touch("pointerdown", target, x, y);
	await new Promise((resolve) => setTimeout(resolve, 500));
	touch("pointerup", target, x, y);
	target.dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
		}),
	);
};

const mouseContextMenu = (target: Element) => {
	const rect = target.getBoundingClientRect();
	target.dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			cancelable: true,
			pointerType: "mouse",
			button: 2,
			clientX: rect.left + 4,
			clientY: rect.top + 4,
		}),
	);
	target.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 4,
			clientY: rect.top + 4,
		}),
	);
};

export const MenuTriggers: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col gap-4 bg-background p-4">
			<MessageRow
				author={{
					name: "Lis",
					seed: "did:plc:lis",
					avatarSrc: storyImages.tealIcon(),
				}}
				timestamp="2026-10-10T09:30:00Z"
				now="2026-10-10T10:00:00Z"
				locale="en-GB"
				platform="mobile"
				onAuthorClick={spy.authorClick}
				onAuthorMenu={spy.authorMenu}
			>
				Hold my avatar for the member menu.
			</MessageRow>
			<div class="rounded-surface bg-popover-highlight">
				<MemberRow
					variant="mobile"
					name="Ana"
					seed="did:plc:ana"
					presence="online"
					onOpen={spy.rowOpen}
					onMenu={spy.rowMenu}
				/>
			</div>
			<p class="text-sm">
				Ping{" "}
				<ChipButton
					label="Open Ben's profile"
					onClick={spy.chipClick}
					onMenu={spy.chipMenu}
				>
					@Ben
				</ChipButton>{" "}
				about the herons.
			</p>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const avatar = canvas.getByRole("button", { name: "Lis's profile" });
		await longPress(avatar);
		await expect(spy.authorMenu).toHaveBeenCalledTimes(1);
		await expect(spy.authorClick).not.toHaveBeenCalled();
		await expect(avatar).toHaveAttribute("data-member-menu");

		const name = canvasElement.querySelector(
			"button[data-author-name]",
		) as HTMLElement;
		await longPress(name);
		await expect(spy.authorMenu).toHaveBeenCalledTimes(2);
		await expect(spy.authorClick).not.toHaveBeenCalled();
		mouseContextMenu(name);
		await expect(spy.authorMenu).toHaveBeenCalledTimes(3);
		await userEvent.click(avatar);
		await expect(spy.authorClick).toHaveBeenCalledTimes(1);

		const row = canvasElement.querySelector("[data-member-row]") as HTMLElement;
		await longPress(row);
		await expect(spy.rowMenu).toHaveBeenCalledTimes(1);
		await expect(spy.rowOpen).not.toHaveBeenCalled();
		mouseContextMenu(row);
		await expect(spy.rowMenu).toHaveBeenCalledTimes(2);

		const chip = canvas.getByRole("button", { name: "Open Ben's profile" });
		await longPress(chip);
		await expect(spy.chipMenu).toHaveBeenCalledTimes(1);
		await expect(spy.chipClick).not.toHaveBeenCalled();
		await userEvent.click(chip);
		await expect(spy.chipClick).toHaveBeenCalledTimes(1);
	},
};

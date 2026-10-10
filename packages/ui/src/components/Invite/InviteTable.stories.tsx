import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Modal, ModalContent } from "../Modal/Modal";
import { InviteTable } from "./InviteTable";
import { FIXED_NOW, inviteFixtures } from "./invite-fixtures";
import type { InviteSummary } from "./invite-links";
import {
	INVITE_ACCESS_COPY,
	type InviteRequest,
	type SpaceJoinMode,
} from "./invite-settings";

const meta = {
	title: "Surfaces/Invite table",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const deleted = fn((_code: string) => {});
const created = fn((_request: InviteRequest) => {});
const copied = fn((_code: string) => {});

const Scene = (props: {
	invites?: InviteSummary[];
	loading?: boolean;
	width?: number;
	canDelete?: boolean;
	joinMode?: SpaceJoinMode;
}) => {
	const [invites, setInvites] = createSignal(props.invites ?? inviteFixtures);
	let next = 0;
	return (
		<Modal defaultOpen>
			<ModalContent
				title="Invites"
				class="max-w-full md:w-auto"
				onCloseAutoFocus={(event) => event.preventDefault()}
			>
				<div
					data-settings-content=""
					style={{ width: `${props.width ?? 878}px`, "max-width": "100%" }}
				>
					<InviteTable
						invites={invites()}
						loading={props.loading}
						now={FIXED_NOW}
						spaceName="Awesome Space"
						joinMode={props.joinMode}
						onCopy={(invite) => copied(invite.code)}
						onDelete={
							props.canDelete === false
								? undefined
								: async (invite) => {
										deleted(invite.code);
										await new Promise((resolve) => setTimeout(resolve, 80));
										setInvites((list) =>
											list.filter((entry) => entry.code !== invite.code),
										);
									}
						}
						onCreate={async (request) => {
							created(request);
							await new Promise((resolve) => setTimeout(resolve, 80));
							next += 1;
							const code = `newLink${next}abcd`;
							setInvites((list) => [
								{
									code,
									url: `https://colibri.social/invite/${code}`,
									creator: { handle: "entropic.software" },
									uses: 0,
									maxUses: request.maxUses,
									expiresAt: request.expiresAt,
								},
								...list,
							]);
						}}
					/>
				</div>
			</ModalContent>
		</Modal>
	);
};

const stubClipboard = () => {
	const writeText = fn(async (_value: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	return writeText;
};

const rightClick = (element: Element) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 24,
			clientY: rect.top + rect.height / 2,
		}),
	);
};

const visibleName = (item: Element) => {
	const copy = item.cloneNode(true) as Element;
	for (const hidden of copy.querySelectorAll("[aria-hidden=true]"))
		hidden.remove();
	return copy.textContent?.trim();
};

const menuItems = (menu: HTMLElement) =>
	within(menu).getAllByRole("menuitem").map(visibleName);

const list = async () => {
	const root = await waitFor(() => {
		const element = document.querySelector<HTMLElement>("[data-invite-list]");
		if (!element) throw new Error("list not mounted");
		return element;
	});
	const dialog = root.closest<HTMLElement>("[role=dialog]");
	if (dialog)
		await Promise.all(
			dialog
				.getAnimations({ subtree: true })
				.filter(
					(animation) =>
						animation.effect?.getComputedTiming().iterations !== Infinity,
				)
				.map((animation) => animation.finished),
		);
	return root;
};

const codeText = (root: HTMLElement, code: string) =>
	within(row(root, code)).getByText(code);

const row = (root: HTMLElement, code: string) => {
	const element = root.querySelector<HTMLElement>(`[data-table-row="${code}"]`);
	if (!element) throw new Error(`row ${code} missing`);
	return element;
};

const waitForMenuClosed = () =>
	waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
		timeout: 3000,
	});

const expectNoHorizontalOverflow = async (root: HTMLElement) => {
	const scrollers = [
		root,
		...root.querySelectorAll<HTMLElement>(
			"table, [data-table-row], [data-table-scroller]",
		),
	];
	for (const element of scrollers)
		await expect(
			element.scrollWidth,
			`${element.tagName} ${element.className}`,
		).toBeLessThanOrEqual(element.clientWidth + 1);
	const box = root.getBoundingClientRect();
	for (const button of root.querySelectorAll<HTMLElement>("button")) {
		const rect = button.getBoundingClientRect();
		if (rect.width === 0) continue;
		await expect(rect.right).toBeLessThanOrEqual(box.right + 1);
	}
};

const playVariant = async () => {
	const writeText = stubClipboard();
	deleted.mockClear();
	created.mockClear();
	copied.mockClear();
	const root = await list();
	const view = within(root);

	await expect(root.querySelector("[data-invite-access]")).toHaveTextContent(
		INVITE_ACCESS_COPY.open,
	);
	await expect(
		within(row(root, "expiredLink01")).getByText("Expired"),
	).toBeVisible();
	await expect(
		within(row(root, "usedUpLink777")).getByText("Used up"),
	).toBeVisible();
	await expect(
		within(row(root, "expiredLink01")).queryByRole("button", {
			name: /^Copy invite link/,
		}),
	).toBeNull();

	rightClick(codeText(root, "pQ7mZr2xLw4aB"));
	const menu = await screen.findByRole(
		"menu",
		{ name: "Invite pQ7mZr2xLw4aB options" },
		{ timeout: 3000 },
	);
	await expect(menuItems(menu)).toEqual([
		"Copy invite link",
		"Share invite",
		"Delete invite link",
	]);
	await userEvent.click(
		within(menu).getByRole("menuitem", { name: "Copy invite link" }),
	);
	await waitFor(() =>
		expect(writeText).toHaveBeenCalledWith(
			"https://colibri.social/invite/pQ7mZr2xLw4aB",
		),
	);
	await waitForMenuClosed();
	await waitFor(() =>
		expect(root.querySelector("[data-invite-announcer]")).toHaveTextContent(
			"Invite link copied",
		),
	);

	writeText.mockClear();
	const copyButton = view.getByRole("button", {
		name: "Copy invite link kjAnf91jad92Q",
	});
	await userEvent.click(copyButton);
	await waitFor(() =>
		expect(writeText).toHaveBeenCalledWith(
			"https://colibri.social/invite/kjAnf91jad92Q",
		),
	);
	await expect(copied).toHaveBeenCalledWith("kjAnf91jad92Q");
	await waitFor(() =>
		expect(
			view.getByRole("button", { name: /^Copied invite link kjAnf91jad92Q/ }),
		).toBeInTheDocument(),
	);

	const expiredMenu = view.getByRole("button", {
		name: "More actions for invite expiredLink01",
	});
	await userEvent.click(expiredMenu);
	const limited = await screen.findByRole(
		"menu",
		{ name: "More actions for invite expiredLink01" },
		{ timeout: 3000 },
	);
	await expect(menuItems(limited)).toEqual(["Delete invite link"]);
	await userEvent.click(
		within(limited).getByRole("menuitem", { name: "Delete invite link" }),
	);
	const confirm = await screen.findByRole(
		"dialog",
		{ name: "Delete invite link?" },
		{ timeout: 3000 },
	);
	await userEvent.click(
		within(confirm).getByRole("button", { name: "Cancel" }),
	);
	await waitFor(
		() =>
			expect(
				screen.queryByRole("dialog", { name: "Delete invite link?" }),
			).toBeNull(),
		{ timeout: 3000 },
	);
	await waitFor(() => expect(expiredMenu).toHaveFocus(), { timeout: 3000 });
	await expect(deleted).not.toHaveBeenCalled();

	await userEvent.click(expiredMenu);
	const again = await screen.findByRole(
		"menu",
		{ name: "More actions for invite expiredLink01" },
		{ timeout: 3000 },
	);
	await userEvent.click(
		within(again).getByRole("menuitem", { name: "Delete invite link" }),
	);
	const confirmAgain = await screen.findByRole(
		"dialog",
		{ name: "Delete invite link?" },
		{ timeout: 3000 },
	);
	await userEvent.click(
		within(confirmAgain).getByRole("button", { name: "Delete invite link" }),
	);
	await waitFor(() => expect(deleted).toHaveBeenCalledWith("expiredLink01"));
	await waitFor(
		() =>
			expect(root.querySelector('[data-table-row="expiredLink01"]')).toBeNull(),
		{ timeout: 3000 },
	);
	await waitFor(
		() =>
			expect(
				within(row(root, "usedUpLink777")).getByRole("button", {
					name: "More actions for invite usedUpLink777",
				}),
			).toHaveFocus(),
		{ timeout: 3000 },
	);
	await waitFor(() =>
		expect(root.querySelector("[data-invite-announcer]")).toHaveTextContent(
			"Invite link expiredLink01 deleted",
		),
	);

	const create = view.getByRole("button", { name: "Create invite link" });
	create.focus();
	const reached: string[] = [];
	for (let step = 0; step < 5; step += 1) {
		await userEvent.tab();
		const active = document.activeElement as HTMLElement;
		reached.push(active.getAttribute("aria-label") ?? "");
		await waitFor(() =>
			expect(
				Number(getComputedStyle(active.parentElement as Element).opacity),
			).toBe(1),
		);
	}
	const byRow = (code: string) =>
		reached
			.filter((name) => name.endsWith(code))
			.map((name) => name.replace(/^Copied/, "Copy"))
			.sort();
	await expect(byRow("kjAnf91jad92Q")).toEqual([
		"Copy invite link kjAnf91jad92Q",
		"More actions for invite kjAnf91jad92Q",
	]);
	await expect(byRow("pQ7mZr2xLw4aB")).toEqual([
		"Copy invite link pQ7mZr2xLw4aB",
		"More actions for invite pQ7mZr2xLw4aB",
	]);
	await expect(
		reached.slice(0, 2).every((name) => name.endsWith("kjAnf91jad92Q")),
	).toBe(true);
	await expect(reached[4]).toBe("More actions for invite usedUpLink777");

	await userEvent.click(create);
	const createDialog = await screen.findByRole(
		"dialog",
		{ name: "Create invite link" },
		{ timeout: 3000 },
	);
	await userEvent.click(
		within(createDialog).getByRole("button", { name: "Create new link" }),
	);
	await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
	await waitFor(
		() =>
			expect(
				screen.queryByRole("dialog", { name: "Create invite link" }),
			).toBeNull(),
		{ timeout: 3000 },
	);
	await waitFor(() => expect(row(root, "newLink1abcd")).toBeInTheDocument());
	await waitFor(() =>
		expect(root.querySelector("[data-invite-announcer]")).toHaveTextContent(
			"Invite link created",
		),
	);

	await expectNoHorizontalOverflow(root);
};

const playMinimumWidth = async () => {
	const root = await list();
	await expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(415);
	await expectNoHorizontalOverflow(root);
	rightClick(codeText(root, "kjAnf91jad92Q"));
	const menu = await screen.findByRole(
		"menu",
		{ name: "Invite kjAnf91jad92Q options" },
		{ timeout: 3000 },
	);
	const rect = menu.getBoundingClientRect();
	await expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
	await expect(rect.left).toBeGreaterThanOrEqual(0);
	await userEvent.click(
		within(menu).getByRole("menuitem", { name: "Copy invite link" }),
	);
	await waitForMenuClosed();
};

const playEmpty = async () => {
	const root = await list();
	await expect(within(root).getByText("No invite links yet")).toBeVisible();
	const buttons = within(root).getAllByRole("button", {
		name: "Create invite link",
	});
	await expect(buttons).toHaveLength(1);
	await userEvent.click(buttons[0]);
	await screen.findByRole(
		"dialog",
		{ name: "Create invite link" },
		{ timeout: 3000 },
	);
};

const playLoading = async () => {
	const root = await list();
	await expect(root).toHaveAttribute("aria-busy", "true");
	await expect(within(root).getByText("Loading invite links")).toHaveAttribute(
		"role",
		"status",
	);
	await expect(
		within(root).getByRole("button", { name: "Create invite link" }),
	).toBeDisabled();
};

const playReadOnly = async () => {
	const root = await list();
	await expect(
		within(root).queryByRole("button", {
			name: "More actions for invite expiredLink01",
		}),
	).toBeNull();
	rightClick(codeText(root, "pQ7mZr2xLw4aB"));
	const menu = await screen.findByRole(
		"menu",
		{ name: "Invite pQ7mZr2xLw4aB options" },
		{ timeout: 3000 },
	);
	await expect(menuItems(menu)).toEqual(["Copy invite link", "Share invite"]);
	await userEvent.click(
		within(menu).getByRole("menuitem", { name: "Copy invite link" }),
	);
	await waitForMenuClosed();
};

export const Default: Story = {
	render: () => <Scene />,
	play: playVariant,
};

export const RequiresApproval: Story = {
	render: () => <Scene joinMode="approval" />,
	play: async () => {
		const root = await list();
		const access = root.querySelector("[data-invite-access]");
		await expect(access).toHaveAttribute("data-invite-access", "approval");
		await expect(access).toHaveTextContent(INVITE_ACCESS_COPY.approval);
		await expect(root).not.toHaveTextContent(INVITE_ACCESS_COPY.open);
	},
};

export const MinimumWidth: Story = {
	render: () => <Scene width={414} />,
	play: playMinimumWidth,
};

export const WithoutDeletePermission: Story = {
	render: () => <Scene canDelete={false} />,
	play: playReadOnly,
};

export const Empty: Story = {
	render: () => <Scene invites={[]} />,
	play: playEmpty,
};

export const Loading: Story = {
	render: () => <Scene loading />,
	play: playLoading,
};

const openDeleteConfirm = async (root: HTMLElement, code: string) => {
	await userEvent.click(
		within(root).getByRole("button", {
			name: `More actions for invite ${code}`,
		}),
	);
	const menu = await screen.findByRole(
		"menu",
		{ name: `More actions for invite ${code}` },
		{ timeout: 3000 },
	);
	await userEvent.click(
		within(menu).getByRole("menuitem", { name: "Delete invite link" }),
	);
	const dialog = await screen.findByRole(
		"dialog",
		{ name: "Delete invite link?" },
		{ timeout: 3000 },
	);
	await expect(dialog).toHaveAccessibleDescription(
		`People can no longer join with ${code}. Members who already joined stay in the Space.`,
	);
	return dialog;
};

const expectCodeWhileClosing = async (dialog: HTMLElement, code: string) => {
	await waitFor(() => expect(dialog).toHaveAttribute("data-closed"));
	await expect(dialog.isConnected).toBe(true);
	await expect(dialog).toHaveTextContent(
		`People can no longer join with ${code}.`,
	);
	await waitFor(() => expect(dialog.isConnected).toBe(false), {
		timeout: 3000,
	});
};

export const DeleteConfirmHoldsWhileClosing: Story = {
	render: () => <Scene />,
	play: async () => {
		deleted.mockClear();
		const root = await list();

		const cancelled = await openDeleteConfirm(root, "expiredLink01");
		await userEvent.click(
			within(cancelled).getByRole("button", { name: "Cancel" }),
		);
		await expectCodeWhileClosing(cancelled, "expiredLink01");
		await expect(deleted).not.toHaveBeenCalled();

		const confirmed = await openDeleteConfirm(root, "usedUpLink777");
		await userEvent.click(
			within(confirmed).getByRole("button", { name: "Delete invite link" }),
		);
		await waitFor(() => expect(deleted).toHaveBeenCalledWith("usedUpLink777"));
		await expectCodeWhileClosing(confirmed, "usedUpLink777");
	},
};

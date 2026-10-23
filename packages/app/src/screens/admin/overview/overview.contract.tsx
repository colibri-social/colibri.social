import {
	Button,
	ListGroup,
	Modal,
	ModalContent,
	NavHeader,
	NavRow,
	SidebarNavItem,
	SidebarNavSection,
	SpaceIcon,
	StatusScreen,
	TextField,
	toast,
} from "@colibri-social/ui";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import { LinkRoundIcon } from "@solar-icons/solid/bold/link-round";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { Server2Icon } from "@solar-icons/solid/bold/server-2";
import { ShareCircleIcon } from "@solar-icons/solid/bold/share-circle";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { createSignal, For, type JSX, Show } from "solid-js";
import { defineContract, slot } from "../../../screen/define";
import type { Platform } from "../../../screen/platform";
import type { AdminPage } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminDeveloper } from "../developer";
import { moveOffSpace, SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";
import { createLeaveSpace } from "./leave-space";

type Section = {
	page: AdminPage;
	label: string;
	icon: () => JSX.Element;
	visible: () => boolean;
};

type SidebarProps = {
	platform?: Platform;
	active?: AdminPage;
	onSelect?: (page: AdminPage) => void;
};

export const DELETE_SPACE_COPY = {
	title: (name: string) => `Delete ${name}?`,
	description:
		"To delete this Space and all associated data, type in the name of the Space below. This action cannot be undone.",
	confirm: "Delete Space",
	failed: "Couldn't delete the Space",
} as const;

export const overview = defineContract({
	id: "adminOverview",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community, can } = admin;
		const leave = createLeaveSpace();
		const [deleteOpen, setDeleteOpen] = createSignal(false);
		const [confirmation, setConfirmation] = createSignal("");
		const [deleting, setDeleting] = createSignal(false);
		const open = (page: AdminPage) =>
			stack.push({ kind: "admin", space: args.space, page });
		const manage = () => can(SPACE_PERMISSIONS.manage);
		const sections: Section[] = [
			{
				page: "profile",
				label: "Space profile",
				icon: () => <InfoCircleIcon />,
				visible: manage,
			},
			{
				page: "invites",
				label: "Invite links",
				icon: () => <LinkRoundIcon />,
				visible: () =>
					can(SPACE_PERMISSIONS.createInvite) ||
					can(SPACE_PERMISSIONS.deleteInvite),
			},
			{
				page: "roles",
				label: "Roles",
				icon: () => <UserIdIcon />,
				visible: () => can(SPACE_PERMISSIONS.roles),
			},
			{
				page: "members",
				label: "Members",
				icon: () => <UsersGroupRoundedIcon />,
				visible: () => !!community(),
			},
			{
				page: "emoji",
				label: "Emoji packs",
				icon: () => <SmileCircleIcon />,
				visible: manage,
			},
			{
				page: "bridges",
				label: "Bridges",
				icon: () => <ShareCircleIcon />,
				visible: manage,
			},
			{
				page: "messages",
				label: "Messages",
				icon: () => <ChatRoundDotsIcon />,
				visible: manage,
			},
		];
		const matches = () => confirmation() === community()?.name;
		const askDelete = () => {
			setConfirmation("");
			setDeleteOpen(true);
		};
		const remove = async () => {
			const current = community();
			if (!current || !matches() || deleting()) return;
			setDeleting(true);
			try {
				await data.community.remove(current.did);
				setDeleteOpen(false);
				moveOffSpace(data, stack, current.did);
				toast.success(`${current.name} was deleted`);
			} catch {
				toast.error(DELETE_SPACE_COPY.failed);
			} finally {
				setDeleting(false);
			}
		};
		return {
			...admin,
			stack,
			leave,
			open,
			sections: () => sections.filter((section) => section.visible()),
			developerMode: () => data.controls().developerMode,
			developerTarget: () => {
				const current = community();
				return data.controls().developerMode && current
					? { copyValue: `at://${current.did}` }
					: undefined;
			},
			isOwner: () => !!community()?.viewer.isOwner,
			canDelete: () => can(SPACE_PERMISSIONS.delete),
			canLeave: () => !!community() && !community()?.viewer.isOwner,
			deleteOpen,
			setDeleteOpen: (next: boolean) => {
				if (!next && deleting()) return;
				setDeleteOpen(next);
			},
			askDelete,
			confirmation,
			setConfirmation,
			matches,
			deleting,
			remove,
		};
	},
	slots: {
		Header: slot((m) => (
			<NavHeader
				safeTop
				kind="close"
				navigateLabel="Close"
				onNavigate={() => m.stack.pop()}
				title="Manage Space"
			/>
		)),
		Missing: slot((m) => (
			<Show when={m.missing()}>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Summary: slot((m, p: { platform?: Platform }) => (
			<Show when={m.community()}>
				{(community) => (
					<div
						data-space-settings-summary=""
						class={
							p.platform === "desktop"
								? "flex min-w-0 items-center gap-3 rounded-control bg-secondary p-2"
								: "flex min-w-0 items-center gap-3"
						}
					>
						<SpaceIcon
							name={community().name}
							src={community().picture}
							size={p.platform === "desktop" ? 32 : 48}
						/>
						<div class="flex min-w-0 flex-col">
							<span
								class={
									p.platform === "desktop"
										? "truncate text-base font-bold"
										: "truncate text-lg font-bold"
								}
							>
								{community().name}
							</span>
							<span class="truncate text-sm text-muted-foreground">
								{`${(community().memberCount ?? 0).toLocaleString("en-GB")} ${community().memberCount === 1 ? "member" : "members"}`}
							</span>
						</div>
					</div>
				)}
			</Show>
		)),
		Sections: slot((m, p: SidebarProps) => (
			<Show when={m.sections().length > 0}>
				<Show
					when={p.platform !== "desktop"}
					fallback={
						<SidebarNavSection label="Space">
							<For each={m.sections()}>
								{(section) => (
									<SidebarNavItem
										label={section.label}
										icon={section.icon()}
										active={p.active === section.page}
										onClick={() => p.onSelect?.(section.page)}
									/>
								)}
							</For>
						</SidebarNavSection>
					}
				>
					<ListGroup>
						<For each={m.sections()}>
							{(section) => (
								<NavRow
									label={section.label}
									icon={section.icon()}
									onClick={() => m.open(section.page)}
								/>
							)}
						</For>
					</ListGroup>
				</Show>
			</Show>
		)),
		Developer: slot((m) => <AdminDeveloper target={m.developerTarget()} />),
		Actions: slot((m, p: SidebarProps) => (
			<Show when={m.community()}>
				<Show
					when={p.platform !== "desktop"}
					fallback={
						<Show when={m.isOwner() || m.canDelete() || m.canLeave()}>
							<SidebarNavSection label="Danger zone">
								<Show when={m.isOwner()}>
									<SidebarNavItem
										label="Hosting"
										icon={<Server2Icon />}
										tone="destructive"
										active={
											p.active === "hosting" || p.active === "hosting-move"
										}
										onClick={() => p.onSelect?.("hosting")}
									/>
									<SidebarNavItem
										label="Transfer ownership"
										icon={<TransferHorizontalIcon />}
										tone="destructive"
										active={p.active === "transfer"}
										onClick={() => p.onSelect?.("transfer")}
									/>
								</Show>
								<Show when={m.canDelete()}>
									<SidebarNavItem
										label="Delete Space"
										icon={<TrashBinTrashIcon />}
										tone="destructive"
										onClick={m.askDelete}
									/>
								</Show>
								<Show when={m.canLeave()}>
									<SidebarNavItem
										label="Leave Space"
										icon={<Logout2Icon />}
										tone="destructive"
										onClick={() => {
											const current = m.community();
											if (current) m.leave.open(current);
										}}
									/>
								</Show>
							</SidebarNavSection>
						</Show>
					}
				>
					<div data-space-settings-actions="" class="flex flex-col gap-2">
						<Show when={m.isOwner()}>
							<Button
								variant="destructive-subtle"
								block
								onClick={() => m.open("hosting")}
							>
								Hosting
							</Button>
							<Button
								variant="destructive-subtle"
								block
								onClick={() => m.open("transfer")}
							>
								Transfer ownership
							</Button>
						</Show>
						<Show when={m.canDelete()}>
							<Button variant="destructive" block onClick={m.askDelete}>
								Delete Space
							</Button>
						</Show>
						<Show when={m.canLeave()}>
							<Button
								variant="destructive-subtle"
								block
								onClick={() => {
									const current = m.community();
									if (current) m.leave.open(current);
								}}
							>
								Leave Space
							</Button>
						</Show>
					</div>
				</Show>
				<m.leave.Dialog />
			</Show>
		)),
		DeleteDialog: slot((m) => (
			<Modal open={m.deleteOpen()} onOpenChange={m.setDeleteOpen}>
				<ModalContent
					title={DELETE_SPACE_COPY.title(m.community()?.name ?? "this Space")}
					description={DELETE_SPACE_COPY.description}
					footer={
						<>
							<Button
								variant="secondary"
								disabled={m.deleting()}
								onClick={() => m.setDeleteOpen(false)}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								disabled={!m.matches()}
								loading={m.deleting()}
								onClick={() => void m.remove()}
							>
								{DELETE_SPACE_COPY.confirm}
							</Button>
						</>
					}
				>
					<TextField
						label="Space name"
						value={m.confirmation()}
						onChange={m.setConfirmation}
						placeholder={m.community()?.name}
						disabled={m.deleting()}
						autocomplete="off"
					/>
				</ModalContent>
			</Modal>
		)),
	},
});

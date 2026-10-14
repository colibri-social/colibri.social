import {
	Button,
	ConfirmDialog,
	copyText,
	formatInviteExpiry,
	formatInviteUses,
	InviteCard,
	type InviteRequest,
	type InviteSummary,
	InviteTable,
	inviteMenuEntries,
	inviteState,
	MenuDrawer,
	Skeleton,
	shareOrCopy,
	toast,
} from "@colibri-social/ui";
import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import {
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import type { InvitationView } from "../../../data/access";
import { defineContract, slot } from "../../../screen/define";
import type { Platform } from "../../../screen/platform";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { LoadFailed, SpaceMissing, toInviteSummary } from "../access-shared";
import { AdminNavHeader } from "../desktop/page-header";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";

export const INVITES_COPY = {
	title: "Invite links",
	emptyTitle: "No invite links yet",
	emptyBody:
		"Create a link to invite people to this Space. You choose how long it works and how often it can be used.",
	forbidden: "You don't have permission to manage invite links.",
} as const;

export const invites = defineContract({
	id: "adminInvites",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community, can } = admin;
		const canCreate = () => can(SPACE_PERMISSIONS.createInvite);
		const canDelete = () => can(SPACE_PERMISSIONS.deleteInvite);
		const list = createMemo(() => {
			const current = community();
			return current && canCreate()
				? data.access.invitations(current.did)
				: undefined;
		});
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const [now, setNow] = createSignal(new Date());
		const timer = setInterval(() => setNow(new Date()), 60_000);
		onCleanup(() => clearInterval(timer));
		const creatorOf = (did: InvitationView["createdBy"]) => {
			if (did === data.viewer.did) {
				return {
					did,
					handle: data.viewer.handle,
					avatar: data.viewer.avatar,
				};
			}
			const actor = space()?.memberByDid(did)?.actor;
			return {
				did,
				handle: actor?.handle ?? "former member",
				avatar: actor?.avatar,
			};
		};
		const summaries = createMemo(() => {
			const summaries = (list()?.value() ?? []).map((invitation) =>
				toInviteSummary(invitation, creatorOf(invitation.createdBy)),
			);
			const active = (summary: InviteSummary) =>
				inviteState(summary, now()) === "active" ? 0 : 1;
			return summaries
				.map((summary, index) => ({ summary, index }))
				.sort(
					(a, b) => active(a.summary) - active(b.summary) || a.index - b.index,
				)
				.map((entry) => entry.summary);
		});
		const [menuTarget, setMenuTarget] = createSignal<InviteSummary>();
		const [menuOpen, setMenuOpen] = createSignal(false);
		const [deleteTarget, setDeleteTarget] = createSignal<InviteSummary>();
		const [deleteOpen, setDeleteOpen] = createSignal(false);
		const copy = async (invite: InviteSummary) => {
			if (await copyText(invite.url)) toast.success("Invite link copied");
			else toast.error("The invite link couldn't be copied");
		};
		const share = async (invite: InviteSummary) => {
			const result = await shareOrCopy({
				title: `Join ${community()?.name ?? "this Space"} on Colibri`,
				url: invite.url,
			});
			if (result === "copied") toast.success("Invite link copied");
			if (result === "failed")
				toast.error("The invite link couldn't be shared");
		};
		const entries = () => {
			const invite = menuTarget();
			if (!invite) return [];
			const active = inviteState(invite, now()) === "active";
			return inviteMenuEntries({
				onCopyLink: active ? () => void copy(invite) : undefined,
				onShare: active ? () => void share(invite) : undefined,
				onDelete: canDelete()
					? () => {
							setDeleteTarget(invite);
							setDeleteOpen(true);
						}
					: undefined,
			});
		};
		const remove = async () => {
			const current = community();
			const invite = deleteTarget();
			if (!current || !invite) return;
			try {
				await data.access.deleteInvitation(current.did, invite.code);
			} catch (error) {
				toast.error("Failed to delete invite link.");
				throw error;
			}
		};
		return {
			...admin,
			back: () => stack.pop(),
			create: () =>
				stack.push({
					kind: "admin",
					space: args.space,
					page: "invite",
					id: NEW_ENTRY,
				}),
			canCreate,
			list,
			now,
			summaries,
			openMenu: (invite: InviteSummary) => {
				setMenuTarget(invite);
				setMenuOpen(true);
			},
			menuTarget,
			menuOpen,
			setMenuOpen,
			entries,
			deleteTarget,
			deleteOpen,
			setDeleteOpen,
			remove,
			copy,
			share,
			canDelete,
			removeInvite: async (invite: InviteSummary) => {
				const current = community();
				if (!current) return;
				try {
					await data.access.deleteInvitation(current.did, invite.code);
				} catch (error) {
					toast.error("Failed to delete invite link.");
					throw error;
				}
			},
			createInvite: async (request: InviteRequest) => {
				const current = community();
				if (!current) return;
				await data.access.createInvitation({
					community: current.did,
					...request,
				});
			},
		};
	},
	slots: {
		Header: slot((m, p: { platform?: Platform }) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title={INVITES_COPY.title}
				action={
					m.canCreate() && !m.missing() && p.platform !== "desktop"
						? {
								type: "icon",
								label: "Create invite link",
								icon: <AddCircleIcon />,
								onClick: m.create,
							}
						: undefined
				}
			/>
		)),
		Missing: slot(() => <SpaceMissing />),
		Invites: slot((m, p: { platform?: Platform }) => (
			<Switch>
				<Match when={!m.canCreate()}>
					<p class="m-0 text-sm text-muted-foreground">
						{INVITES_COPY.forbidden}
					</p>
				</Match>
				<Match when={m.list()?.error()}>
					<LoadFailed
						title="Couldn't load invite links"
						onRetry={() => void m.list()?.refresh()}
					/>
				</Match>
				<Match when={!m.list()?.value()}>
					<div
						role="status"
						aria-label="Loading invite links"
						class="flex flex-col gap-3"
					>
						<For each={[0, 1, 2]}>
							{() => <Skeleton class="h-[132px] w-full rounded-control" />}
						</For>
					</div>
				</Match>
				<Match when={p.platform === "desktop" && m.list()?.value()}>
					<InviteTable
						invites={m.summaries()}
						now={m.now()}
						spaceName={m.community()?.name}
						joinMode={
							m.community()?.requiresApprovalToJoin ? "approval" : "open"
						}
						onCopy={() => toast.success("Invite link copied")}
						onShare={(invite) => void m.share(invite)}
						onDelete={m.canDelete() ? m.removeInvite : undefined}
						onCreate={m.createInvite}
					/>
				</Match>
				<Match when={m.list()?.value()}>
					<Show
						when={m.summaries().length > 0}
						fallback={
							<div
								data-invite-empty=""
								class="flex flex-col items-center gap-2 rounded-control border border-dashed border-control-border px-4 py-8 text-center"
							>
								<span class="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-5">
									<LinkIcon aria-hidden="true" />
								</span>
								<p class="m-0 text-sm font-semibold text-foreground">
									{INVITES_COPY.emptyTitle}
								</p>
								<p class="m-0 max-w-80 text-sm text-pretty text-muted-foreground">
									{INVITES_COPY.emptyBody}
								</p>
								<Button
									class="mt-2"
									icon={<AddCircleIcon />}
									onClick={m.create}
								>
									Create invite link
								</Button>
							</div>
						}
					>
						<ul class="m-0 flex list-none flex-col gap-4 p-0">
							<For each={m.summaries()}>
								{(invite) => (
									<li>
										<InviteCard
											code={invite.code}
											copyValue={invite.url}
											state={inviteState(invite, m.now())}
											expires={formatInviteExpiry(invite, m.now())}
											creator={invite.creator}
											uses={formatInviteUses(invite)}
											onCopy={() => toast.success("Invite link copied")}
											onMenu={() => m.openMenu(invite)}
										/>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</Match>
			</Switch>
		)),
		Overlays: slot((m, p: { platform?: Platform }) => (
			<Show when={p.platform !== "desktop"}>
				<MenuDrawer
					open={m.menuOpen()}
					onOpenChange={m.setMenuOpen}
					label={`Invite ${m.menuTarget()?.code ?? ""} options`}
					items={m.entries()}
				/>
				<ConfirmDialog
					open={m.deleteOpen()}
					onOpenChange={m.setDeleteOpen}
					title="Delete invite link?"
					description={`People can no longer join with ${m.deleteTarget()?.code ?? ""}. Members who already joined stay in the Space.`}
					confirmLabel="Delete invite link"
					tone="destructive"
					onConfirm={m.remove}
				/>
			</Show>
		)),
	},
});

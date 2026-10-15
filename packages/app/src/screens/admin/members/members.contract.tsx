import {
	Button,
	ConfirmDialog,
	IconButton,
	ListGroup,
	MemberActionRow,
	type MemberIdentityData,
	SearchField,
	toast,
} from "@colibri-social/ui";
import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { RestartIcon } from "@solar-icons/solid/bold/restart";
import {
	createMemo,
	createSignal,
	For,
	type JSX,
	Match,
	type ParentProps,
	Show,
	Switch,
} from "solid-js";
import type { ApplicationView, BannedActorView } from "../../../data/access";
import { displayNameOf } from "../../../data/adapters/authors";
import { roleIdentity, rolesOf, topColoredRole } from "../../../data/roles";
import type { Did, MemberView } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useMemberMenu } from "../../members/member-menu";
import {
	identityOf,
	LoadFailed,
	RowsSkeleton,
	SpaceMissing,
	timeAgo,
} from "../access-shared";
import { AdminNavHeader } from "../desktop/page-header";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";

export const MEMBER_LIMIT = 50;

const MEMBER_DROPDOWN_TRIGGER =
	"block w-full cursor-pointer text-left outline-none hover:bg-secondary-highlight focus-ring-inset data-expanded:bg-secondary-highlight";

export const MEMBERS_COPY = {
	title: "Members",
	search: "Search members",
	requests: "Join requests",
	dismissed: "Dismissed requests",
	bans: "Banned users",
	members: "Members",
	noMatches: (query: string) => `No members match "${query}".`,
	moreMembers: (shown: number, total: number) =>
		`Showing ${shown} of ${total}. Search to find someone else.`,
	noRequests: "No pending join requests.",
	noBans: "No one is banned from this Space.",
	unbanDescription:
		"They can join again with an invite link. Their old messages stay where they are.",
} as const;

const matches = (member: MemberView, needle: string) =>
	[member.nickname, member.actor.displayName, member.actor.handle].some(
		(value) => value?.toLowerCase().includes(needle),
	);

export const members = defineContract({
	id: "adminMembers",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const memberMenu = useMemberMenu();
		const admin = useAdminSpace(args.space);
		const { data, community, can } = admin;
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const canReview = () => can(SPACE_PERMISSIONS.approvals);
		const canUnban = () => can(SPACE_PERMISSIONS.unban);
		const applications = createMemo(() => {
			const current = community();
			return current && canReview()
				? data.access.applications(current.did)
				: undefined;
		});
		const bans = createMemo(() => {
			const current = community();
			return current && canUnban() ? data.access.bans(current.did) : undefined;
		});
		const pending = () =>
			(applications()?.value() ?? []).filter((entry) => !entry.dismissed);
		const dismissed = () =>
			(applications()?.value() ?? []).filter((entry) => entry.dismissed);
		const showRequests = () =>
			canReview() &&
			(!!community()?.requiresApprovalToJoin ||
				(applications()?.value()?.length ?? 0) > 0);

		const [query, setQuery] = createSignal("");
		const ownerRole = () =>
			space()
				?.roles.value()
				?.find((role) => role.protected)?.rkey;
		const identity = (member: MemberView): MemberIdentityData => {
			const current = space();
			const roles = current ? rolesOf(member, current.roleByKey) : [];
			const colored = topColoredRole(roles);
			const owner = ownerRole();
			return {
				id: member.actor.did,
				name: member.nickname ?? displayNameOf(member.actor),
				handle: member.actor.handle,
				avatarSrc: member.actor.avatar,
				role: colored ? roleIdentity(colored) : undefined,
				bot: member.actor.isBot,
				owner: owner ? member.roles.includes(owner) : false,
			};
		};
		const matching = createMemo(() => {
			const needle = query().trim().toLowerCase();
			const list = space()?.members.value() ?? [];
			const found = needle
				? list.filter((member) => matches(member, needle))
				: list;
			return [...found].sort((a, b) =>
				(a.nickname ?? displayNameOf(a.actor)).localeCompare(
					b.nickname ?? displayNameOf(b.actor),
				),
			);
		});
		const shown = () => matching().slice(0, MEMBER_LIMIT);

		const [busy, setBusy] = createSignal<ReadonlySet<Did>>(new Set());
		const isBusy = (did: Did) => busy().has(did);
		const run = async (
			entry: ApplicationView,
			action: (community: Did, subject: Did) => Promise<void>,
			failure: string,
		) => {
			const current = community();
			const did = entry.actor.did;
			if (!current || isBusy(did)) return;
			setBusy((set) => new Set(set).add(did));
			try {
				await action(current.did, did);
			} catch {
				toast.error(failure);
			} finally {
				setBusy((set) => {
					const next = new Set(set);
					next.delete(did);
					return next;
				});
			}
		};

		const [unbanTarget, setUnbanTarget] = createSignal<BannedActorView>();
		const [unbanOpen, setUnbanOpen] = createSignal(false);
		const bannedBy = (entry: BannedActorView) => {
			if (entry.bannedBy === data.viewer.did) return data.viewer.handle;
			return space()?.memberByDid(entry.bannedBy)?.actor.handle;
		};
		const unban = async () => {
			const current = community();
			const entry = unbanTarget();
			if (!current || !entry) return;
			try {
				await data.access.unban(current.did, entry.actor.did);
				toast.success(`${identityOf(entry.actor).name} was unbanned`);
			} catch (error) {
				toast.error("Failed to unban user.");
				throw error;
			}
		};

		return {
			...admin,
			back: () => stack.pop(),
			space,
			query,
			setQuery,
			identity,
			matching,
			shown,
			openMember: (did: Did) => memberMenu.open(did, args.space),
			memberDropdown: (did: Did, row: JSX.Element) =>
				memberMenu.contextMenu(
					did,
					args.space,
					memberMenu.dropdown(did, args.space, row, MEMBER_DROPDOWN_TRIGGER),
				),
			applications,
			showRequests,
			pending,
			dismissed,
			isBusy,
			approve: (entry: ApplicationView) =>
				run(entry, data.access.approve, "Failed to approve request."),
			dismiss: (entry: ApplicationView) =>
				run(entry, data.access.dismiss, "Failed to dismiss request."),
			restore: (entry: ApplicationView) =>
				run(entry, data.access.restore, "Failed to restore request."),
			canUnban,
			bans,
			bannedBy,
			askUnban: (entry: BannedActorView) => {
				setUnbanTarget(entry);
				setUnbanOpen(true);
			},
			unbanName: () => {
				const entry = unbanTarget();
				return entry ? identityOf(entry.actor).name : "";
			},
			unbanOpen,
			setUnbanOpen,
			unban,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title={MEMBERS_COPY.title}
			/>
		)),
		Missing: slot(() => <SpaceMissing />),
		Requests: slot((m) => {
			const Row = (props: ParentProps<{ entry: ApplicationView }>) => (
				<MemberActionRow
					member={identityOf(props.entry.actor)}
					detail={`Requested ${timeAgo(props.entry.createdAt)}`}
					stackDetail
					actions={props.children}
				/>
			);
			const name = (entry: ApplicationView) => identityOf(entry.actor).name;
			return (
				<Show when={m.showRequests()}>
					<Switch>
						<Match when={m.applications()?.error()}>
							<LoadFailed
								title="Couldn't load join requests"
								onRetry={() => void m.applications()?.refresh()}
							/>
						</Match>
						<Match when={!m.applications()?.value()}>
							<RowsSkeleton rows={2} label="Loading join requests" />
						</Match>
						<Match when={m.applications()?.value()}>
							<ListGroup
								label={MEMBERS_COPY.requests}
								count={m.pending().length || undefined}
							>
								<Show
									when={m.pending().length > 0}
									fallback={
										<p class="m-0 px-3 py-3 text-sm text-muted-foreground">
											{MEMBERS_COPY.noRequests}
										</p>
									}
								>
									<For each={m.pending()}>
										{(entry) => (
											<Row entry={entry}>
												<IconButton
													variant="ghost"
													label={`Approve ${name(entry)}`}
													icon={<CheckCircleIcon class="text-success" />}
													loading={m.isBusy(entry.actor.did)}
													onClick={() => void m.approve(entry)}
												/>
												<IconButton
													variant="ghost"
													label={`Dismiss ${name(entry)}`}
													icon={<CloseCircleIcon class="text-destructive" />}
													disabled={m.isBusy(entry.actor.did)}
													onClick={() => void m.dismiss(entry)}
												/>
											</Row>
										)}
									</For>
								</Show>
							</ListGroup>
							<Show when={m.dismissed().length > 0}>
								<ListGroup
									label={MEMBERS_COPY.dismissed}
									count={m.dismissed().length}
								>
									<For each={m.dismissed()}>
										{(entry) => (
											<Row entry={entry}>
												<IconButton
													variant="ghost"
													label={`Approve ${name(entry)}`}
													icon={<CheckCircleIcon class="text-success" />}
													loading={m.isBusy(entry.actor.did)}
													onClick={() => void m.approve(entry)}
												/>
												<IconButton
													variant="ghost"
													label={`Restore ${name(entry)} to the queue`}
													icon={<RestartIcon />}
													disabled={m.isBusy(entry.actor.did)}
													onClick={() => void m.restore(entry)}
												/>
											</Row>
										)}
									</For>
								</ListGroup>
							</Show>
						</Match>
					</Switch>
				</Show>
			);
		}),
		Members: slot((m) => (
			<section class="flex flex-col gap-2">
				<SearchField
					aria-label={MEMBERS_COPY.search}
					placeholder={MEMBERS_COPY.search}
					value={m.query()}
					onChange={m.setQuery}
				/>
				<Switch>
					<Match when={!m.space()?.members.value()}>
						<RowsSkeleton rows={4} label="Loading members" />
					</Match>
					<Match when={m.matching().length === 0}>
						<p class="m-0 px-1 py-2 text-sm text-muted-foreground">
							{MEMBERS_COPY.noMatches(m.query().trim())}
						</p>
					</Match>
					<Match when={m.matching().length > 0}>
						<ListGroup label={MEMBERS_COPY.members} count={m.matching().length}>
							<For each={m.shown()}>
								{(member) => (
									<Show
										when={usePlatform()() === "desktop"}
										fallback={
											<MemberActionRow
												member={m.identity(member)}
												onOpen={() => m.openMember(member.actor.did)}
											/>
										}
									>
										{m.memberDropdown(
											member.actor.did,
											<MemberActionRow member={m.identity(member)} />,
										)}
									</Show>
								)}
							</For>
						</ListGroup>
						<Show when={m.matching().length > m.shown().length}>
							<p
								data-member-limit=""
								class="m-0 px-1 text-sm text-muted-foreground"
							>
								{MEMBERS_COPY.moreMembers(
									m.shown().length,
									m.matching().length,
								)}
							</p>
						</Show>
					</Match>
				</Switch>
			</section>
		)),
		Bans: slot((m) => (
			<Show when={m.canUnban()}>
				<Switch>
					<Match when={m.bans()?.error()}>
						<LoadFailed
							title="Couldn't load banned users"
							onRetry={() => void m.bans()?.refresh()}
						/>
					</Match>
					<Match when={!m.bans()?.value()}>
						<RowsSkeleton rows={2} label="Loading banned users" />
					</Match>
					<Match when={m.bans()?.value()}>
						{(entries) => (
							<ListGroup
								label={MEMBERS_COPY.bans}
								count={entries().length || undefined}
							>
								<Show
									when={entries().length > 0}
									fallback={
										<p class="m-0 px-3 py-3 text-sm text-muted-foreground">
											{MEMBERS_COPY.noBans}
										</p>
									}
								>
									<For each={entries()}>
										{(entry) => (
											<MemberActionRow
												member={identityOf(entry.actor)}
												detail={
													m.bannedBy(entry)
														? `Banned ${timeAgo(entry.bannedAt)} by @${m.bannedBy(entry)}`
														: `Banned ${timeAgo(entry.bannedAt)}`
												}
												note={entry.reason}
												actions={
													<Button
														variant="secondary"
														aria-label={`Unban ${identityOf(entry.actor).name}`}
														onClick={() => m.askUnban(entry)}
													>
														Unban
													</Button>
												}
											/>
										)}
									</For>
								</Show>
							</ListGroup>
						)}
					</Match>
				</Switch>
			</Show>
		)),
		Overlays: slot((m) => (
			<ConfirmDialog
				open={m.unbanOpen()}
				onOpenChange={m.setUnbanOpen}
				title={`Unban ${m.unbanName()}?`}
				description={MEMBERS_COPY.unbanDescription}
				confirmLabel="Unban"
				onConfirm={m.unban}
			/>
		)),
	},
});

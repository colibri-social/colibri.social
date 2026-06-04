import {
	createResource,
	createSignal,
	For,
	Match,
	Show,
	Switch,
	type Accessor,
	type Setter,
} from "solid-js";
import { toast } from "somoto";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
} from "../../ui/Dialog";
import { SettingsPage, type SettingsPageInfo } from "../common/SettingsModal";
import User from "../user";
import GearIcon from "~icons/ph/gear";
import LinkIcon from "~icons/ph/link";
import UsersIcon from "~icons/ph/users";
import ProhibitIcon from "~icons/ph/prohibit";
import XIcon from "~icons/ph/x";
import CopyIcon from "~icons/ph/copy";
import TrashIcon from "~icons/ph/trash";
import { cx } from "../../../utils/cva";

// ---------------------------------------------------------------------------
// General settings page (stub — AppView edit endpoint is coming)
// ---------------------------------------------------------------------------

const GeneralPage = () => {
	const community = useCommunityContext();
	const user = useUserContext();
	const [loading, setLoading] = createSignal(false);
	const [name, setName] = createSignal(community().community.name);
	const [description, setDescription] = createSignal(community().community.description ?? "");

	const isDirty = () =>
		name() !== community().community.name ||
		description() !== (community().community.description ?? "");

	const handleSave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.community.update(
				community().community.uri,
				name().trim() !== community().community.name ? name().trim() : undefined,
				description().trim() !== (community().community.description ?? "") ? description().trim() : undefined,
				undefined,
				undefined,
			);
			toast.success("Community settings saved.");
		} catch {
			toast.error("Failed to save community settings.");
		} finally {
			setLoading(false);
		}
	};

	// Keep local signals in sync if community data changes externally.
	return (
		<SettingsPage
			loading={loading}
			title="General"
			canReset={isDirty()}
			onSave={handleSave}
		>
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium">Name</span>
					<input
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						value={name()}
						maxLength={32}
						onInput={(e) => setName(e.currentTarget.value)}
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium">Description</span>
					<input
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						value={description()}
						maxLength={256}
						onInput={(e) => setDescription(e.currentTarget.value)}
					/>
				</div>
			</div>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Invite links page (functional)
// ---------------------------------------------------------------------------

const InviteLinksPage = () => {
	const community = useCommunityContext();
	const user = useUserContext();
	const uri = () => community().community.uri;

	const [invitations, { refetch }] = createResource(uri, async (u) => {
		const res = await user.xrpc.social.colibri.community.listInvitations(u);
		return res?.codes ?? [];
	});

	const [creating, setCreating] = createSignal(false);

	const handleCreate = async () => {
		setCreating(true);
		const res = await user.xrpc.social.colibri.community.createInvitation(uri());
		setCreating(false);
		if (!res) {
			toast.error("Failed to create invite link.");
			return;
		}
		toast.success(`Invite code created: ${res.code}`);
		refetch();
	};

	const handleDelete = async (code: string) => {
		const res = await user.xrpc.social.colibri.community.deleteInvitation(
			uri(),
			code,
		);
		if (!res) {
			toast.error("Failed to delete invite link.");
			return;
		}
		refetch();
	};

	const handleCopy = (code: string) => {
		const link = `${window.location.origin}/invite/${code}`;
		navigator.clipboard.writeText(link).then(() => {
			toast.success("Invite link copied to clipboard!");
		});
	};

	return (
		<SettingsPage loading={() => false} title="Invite Links">
			<div class="flex flex-col gap-4">
				<Button onClick={handleCreate} disabled={creating()} class="self-start">
					{creating() ? "Creating…" : "Create invite link"}
				</Button>
				<Switch>
					<Match when={invitations.loading}>
						<p class="text-sm text-muted-foreground">Loading…</p>
					</Match>
					<Match when={(invitations() ?? []).length === 0}>
						<p class="text-sm text-muted-foreground">
							No invite links yet. Create one above.
						</p>
					</Match>
					<Match when={(invitations() ?? []).length > 0}>
						<div class="flex flex-col gap-2">
							<For each={invitations()}>
								{(inv) => (
									<div class="flex flex-row items-center justify-between gap-2 border border-border rounded-sm px-3 py-2">
										<div class="flex flex-col gap-0.5">
											<span class="font-mono text-sm">{inv.code}</span>
											<span
												class={cx(
													"text-xs",
													inv.active
														? "text-green-500"
														: "text-muted-foreground",
												)}
											>
												{inv.active ? "Active" : "Inactive"}
											</span>
										</div>
										<div class="flex flex-row gap-1">
											<Button
												variant="ghost"
												size="sm"
												class="w-8 h-8"
												onClick={() => handleCopy(inv.code)}
											>
												<CopyIcon />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												class="w-8 h-8 text-destructive hover:text-destructive"
												onClick={() => handleDelete(inv.code)}
											>
												<TrashIcon />
											</Button>
										</div>
									</div>
								)}
							</For>
						</div>
					</Match>
				</Switch>
			</div>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Blocked users page (functional)
// ---------------------------------------------------------------------------

const BlockedUsersPage = () => {
	const community = useCommunityContext();
	const user = useUserContext();
	const uri = () => community().community.uri;

	const [blockedDIDs, { refetch }] = createResource(uri, async (u) => {
		const res = await user.xrpc.social.colibri.community.listBlockedUsers(u);
		return res?.dids ?? [];
	});

	const handleUnblock = async (did: string) => {
		const res = await user.xrpc.social.colibri.community.unblockUser(
			uri(),
			did,
		);
		if (!res) {
			toast.error("Failed to unblock user.");
			return;
		}
		toast.success("User unblocked.");
		refetch();
	};

	const memberByDID = (did: string) =>
		community().members.find((m) => m.did === did);

	return (
		<SettingsPage loading={() => false} title="Blocked Users">
			<Switch>
				<Match when={blockedDIDs.loading}>
					<p class="text-sm text-muted-foreground">Loading…</p>
				</Match>
				<Match when={(blockedDIDs() ?? []).length === 0}>
					<p class="text-sm text-muted-foreground">No blocked users.</p>
				</Match>
				<Match when={(blockedDIDs() ?? []).length > 0}>
					<div class="flex flex-col gap-2">
						<For each={blockedDIDs()}>
							{(did) => {
								const member = () => memberByDID(did);
								return (
									<div class="flex flex-row items-center justify-between gap-2 border border-border rounded-sm px-3 py-2">
										<div class="flex flex-row items-center gap-2">
											<Show
												when={member()}
												fallback={
													<span class="font-mono text-xs text-muted-foreground truncate max-w-64">
														{did}
													</span>
												}
											>
												{(m) => (
													<>
														<User.Avatar user={m()} size="small" />
														<span class="text-sm">
															<User.DisplayableName user={m()} />
														</span>
													</>
												)}
											</Show>
										</div>
										<Button
											variant="secondary"
											size="sm"
											onClick={() => handleUnblock(did)}
										>
											Unblock
										</Button>
									</div>
								);
							}}
						</For>
					</div>
				</Match>
			</Switch>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Members page (read-only view)
// ---------------------------------------------------------------------------

const MembersPage = () => {
	const community = useCommunityContext();

	return (
		<SettingsPage loading={() => false} title="Members">
			<div class="flex flex-col gap-2">
				<For each={community().members}>
					{(member) => (
						<div class="flex flex-row items-center gap-2 py-1">
							<User.Avatar user={member} size="small" />
							<div class="flex flex-col">
								<span class="text-sm font-medium">
									<User.DisplayableName user={member} />
								</span>
								<span class="text-xs text-muted-foreground">
									@{member.handle}
								</span>
							</div>
						</div>
					)}
				</For>
			</div>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Main modal shell
// ---------------------------------------------------------------------------

type PageId = "general" | "invites" | "blocked" | "members";

const PAGES: Array<{ id: PageId; label: string; icon: typeof GearIcon }> = [
	{ id: "general", label: "General", icon: GearIcon },
	{ id: "invites", label: "Invite Links", icon: LinkIcon },
	{ id: "blocked", label: "Blocked Users", icon: ProhibitIcon },
	{ id: "members", label: "Members", icon: UsersIcon },
];

export const CommunitySettingsModal = (props: {
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
	/** Start on a specific tab (default: "general"). */
	initialPage?: PageId;
}) => {
	const [activePage, setActivePage] = createSignal<PageId>(
		props.initialPage ?? "general",
	);

	return (
		<Dialog open={props.open()} onOpenChange={props.setOpen}>
			<DialogPortal>
				<DialogContent class="w-[75vw] min-w-92 h-fit min-h-128 max-w-3xl! p-0 flex flex-row gap-0 max-h-[calc(100vh-4rem)]!">
					<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
						<DialogCloseButton class="absolute cursor-pointer">
							<XIcon />
						</DialogCloseButton>
					</div>
					{/* Sidebar nav */}
					<div class="min-h-128 h-auto flex flex-col justify-between p-4 min-w-52 border-r border-border">
						<div class="flex flex-col gap-1">
							<For each={PAGES}>
								{(page) => (
									<button
										type="button"
										class="w-full hover:bg-card px-2 py-1 rounded-sm cursor-pointer text-left flex flex-row items-center gap-2 text-sm"
										classList={{
											"bg-muted! text-foreground!":
												activePage() === page.id,
										}}
										onClick={() => setActivePage(page.id)}
									>
										<page.icon />
										{page.label}
									</button>
								)}
							</For>
						</div>
					</div>
					{/* Page content */}
					<Switch>
						<Match when={activePage() === "general"}>
							<GeneralPage />
						</Match>
						<Match when={activePage() === "invites"}>
							<InviteLinksPage />
						</Match>
						<Match when={activePage() === "blocked"}>
							<BlockedUsersPage />
						</Match>
						<Match when={activePage() === "members"}>
							<MembersPage />
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

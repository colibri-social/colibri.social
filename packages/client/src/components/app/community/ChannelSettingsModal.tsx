import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	For,
	on,
	type ParentComponent,
	type Setter,
	Show,
} from "solid-js";
import { toast } from "somoto";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";
import { Spinner } from "../../icons/Spinner";
import BugIcon from "~icons/ph/bug";
import PlusIcon from "~icons/ph/plus";
import ShieldIcon from "~icons/ph/shield";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import type { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import XIcon from "~icons/ph/x";
import type { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import User from "../user";
import { groupMembersByRoles } from "../../../utils/group-members-by-roles";
import { displayableNameFn } from "../user/DisplayableName";

const GeneralChannelSettings: Component<{ channel: Channel }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const initialName = () => props.channel.name;
	const initialDesc = () => props.channel.description || "";

	const [loading, setLoading] = createSignal(false);
	const [name, setName] = createSignal(initialName());
	const [description, setDescription] = createSignal(initialDesc());

	createEffect(on(initialName, (n) => setName(n), { defer: true }));
	createEffect(on(initialDesc, (d) => setDescription(d), { defer: true }));

	const handleSave = async () => {
		setLoading(true);
		try {
			const trimmed = name().trim();
			const res = await user.xrpc.social.colibri.channel.update(
				props.channel.uri,
				trimmed,
				{
					description: description(),
				},
			);
			if (!res) {
				toast.error("Failed to save channel settings.");
				return;
			}
			// Optimistically reflect the save so the form leaves its dirty state
			// immediately; the `channel_event` echo re-applies the same fields.
			community().utils.patchChannel(props.channel.uri, {
				name: trimmed,
				description: description(),
			});
		} catch {
			toast.error("Failed to save channel settings.");
		} finally {
			setLoading(false);
		}
	};

	const isDirty = () => {
		return name() !== initialName() || description() !== initialDesc();
	};

	const handleReset = () => {
		setLoading(false);
		setName(initialName());
		setDescription(initialDesc());
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Channel Settings"
			onSave={handleSave}
			onReset={handleReset}
		>
			<TextField class="gap-1.5">
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput
					value={name()}
					maxLength={32}
					min={1}
					required
					onInput={(e) => setName(e.currentTarget.value)}
				/>
			</TextField>
			<TextField class="gap-1.5">
				<TextFieldLabel>Description</TextFieldLabel>
				<TextFieldInput
					value={description()}
					maxLength={256}
					onInput={(e) => setDescription(e.currentTarget.value)}
				/>
			</TextField>
		</SettingsPage>
	);
};

const DisplayedRole: ParentComponent<{
	role: Role;
	manageable: () => boolean;
	toggleRole?: (uri: string) => void;
}> = (props) => {
	return (
		<button
			type="button"
			disabled={!props.manageable()}
			class="flex flex-row items-center gap-4 justify-between rounded-sm w-full"
			onClick={
				props.toggleRole
					? () => {
							if (!props.manageable() || !props.toggleRole) return;
							props.toggleRole(props.role.uri);
						}
					: undefined
			}
			classList={{
				"hover:bg-muted p-1.5 py-1 cursor-pointer": !props.children,
			}}
		>
			<div class="flex flex-row items-center gap-2 test">
				<div
					class="w-2 h-2 rounded-full"
					style={{
						background: `${props.role.color ?? "#fff"}`,
					}}
				/>
				{props.role.name}
			</div>
			{props.children}
		</button>
	);
};

const DisplayedMember: ParentComponent<{
	member: Member;
	manageable: () => boolean;
	toggleMember?: (did: string) => void;
}> = (props) => {
	return (
		<button
			type="button"
			disabled={!props.manageable()}
			class="flex flex-row items-center gap-4 justify-between rounded-sm w-full"
			onClick={
				props.toggleMember
					? () => {
							if (!props.manageable() || !props.toggleMember) return;
							props.toggleMember(props.member.did);
						}
					: undefined
			}
			classList={{
				"hover:bg-muted p-1.5 py-1 cursor-pointer": !props.children,
			}}
		>
			<div class="flex flex-row items-center gap-2 test">
				<User.InlineProfile user={props.member} color={false} />
			</div>
			{props.children}
		</button>
	);
};

const PermissionsPage: Component<{ channel: Channel }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { isAdmin: _isAdmin, canManageRole, outranks } = usePermissions();

	const isAdmin = () => _isAdmin(user.did);

	const initialOwnerOnly = () => props.channel.ownerOnly || false;
	const initialAllowedRoles = () => props.channel.allowedRoles ?? [];
	const initialAllowedMembers = () => props.channel.allowedMembers ?? [];

	const [loading, setLoading] = createSignal(false);
	const [ownerOnly, setOwnerOnly] = createSignal(initialOwnerOnly());
	// Allow-lists are edited in local state and only committed on save, so adding
	// or removing a role/member stages the change rather than hitting the server.
	const [allowedRoles, setAllowedRoles] = createSignal(initialAllowedRoles());
	const [allowedMembers, setAllowedMembers] = createSignal(
		initialAllowedMembers(),
	);

	// Re-sync when the channel record changes underneath us (see the matching
	// note in GeneralChannelSettings).
	createEffect(on(initialOwnerOnly, (o) => setOwnerOnly(o), { defer: true }));
	createEffect(
		on(initialAllowedRoles, (r) => setAllowedRoles(r), { defer: true }),
	);
	createEffect(
		on(initialAllowedMembers, (m) => setAllowedMembers(m), { defer: true }),
	);

	const handleSave = async () => {
		setLoading(true);
		try {
			const roles = allowedRoles();
			const members = allowedMembers();
			const res = await user.xrpc.social.colibri.channel.update(
				props.channel.uri,
				undefined,
				{
					// Only send ownerOnly when it actually changed: the server gates
					// any ownerOnly write behind an admin check, so sending it on an
					// allow-list-only edit would reject the whole save for non-admins.
					ownerOnly:
						ownerOnly() !== initialOwnerOnly() ? ownerOnly() : undefined,
					// An empty array appends no params, which the server reads as "no
					// change"; the explicit clear flags wipe an allow-list instead.
					allowedRoles: roles.length ? roles : undefined,
					clearAllowedRoles: roles.length === 0,
					allowedMembers: members.length ? members : undefined,
					clearAllowedMembers: members.length === 0,
				},
			);
			if (!res) {
				toast.error("Failed to save permissions.");
				return;
			}
			community().utils.patchChannel(props.channel.uri, {
				ownerOnly: ownerOnly(),
				allowedRoles: roles,
				allowedMembers: members,
			});
		} catch {
			toast.error("Failed to save permissions.");
		} finally {
			setLoading(false);
		}
	};

	const sameSet = (a: string[], b: string[]) =>
		a.length === b.length && a.every((x) => b.includes(x));

	const isDirty = () =>
		ownerOnly() !== initialOwnerOnly() ||
		!sameSet(allowedRoles(), initialAllowedRoles()) ||
		!sameSet(allowedMembers(), initialAllowedMembers());

	const handleReset = () => {
		setLoading(false);
		setOwnerOnly(initialOwnerOnly());
		setAllowedRoles(initialAllowedRoles());
		setAllowedMembers(initialAllowedMembers());
	};

	const addAllowedRole = (uri: string) =>
		setAllowedRoles((prev) => (prev.includes(uri) ? prev : [...prev, uri]));

	const removeAllowedRole = (uri: string) =>
		setAllowedRoles((prev) => prev.filter((r) => r !== uri));

	const addAllowedUser = (did: string) =>
		setAllowedMembers((prev) => (prev.includes(did) ? prev : [...prev, did]));

	const removeAllowedUser = (did: string) =>
		setAllowedMembers((prev) => prev.filter((d) => d !== did));

	// Search query for the "add member" popover; reset whenever it closes.
	const [memberSearch, setMemberSearch] = createSignal("");

	const nonAllowedRoles = () =>
		community()
			.assignableRoles.sort((a, b) => b.position - a.position)
			.filter((x) => !allowedRoles().some((y) => x.uri === y));

	const nonAllowedMembers = () => {
		const query = memberSearch().trim().toLowerCase();
		return community()
			.members.filter((x) => !allowedMembers().some((y) => x.did === y))
			.filter(
				(x) =>
					!query ||
					displayableNameFn(x).toLowerCase().includes(query) ||
					x.handle.toLowerCase().includes(query),
			);
	};

	// The already-allowed members, grouped under their roles exactly like the
	// member sidebar (empty groups dropped).
	const allowedMembersByRoles = () =>
		groupMembersByRoles({
			members: allowedMembers()
				.map((did) => community().members.find((x) => x.did === did))
				.filter((x) => x !== undefined),
			assignableRoles: community().assignableRoles,
			roles: community().roles,
		}).filter((g) => g.members.length > 0);

	// The "add member" candidates, grouped under their roles the same way.
	const nonAllowedMembersByRoles = () =>
		groupMembersByRoles({
			members: nonAllowedMembers(),
			assignableRoles: community().assignableRoles,
			roles: community().roles,
		}).filter((g) => g.members.length > 0);

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Permissions"
			description="Permissions control who can write in this channel. If a user or role is not specified here, they will still see the channel."
			onSave={handleSave}
			onReset={handleReset}
		>
			<Show when={isAdmin()}>
				<div class="w-full border border-border rounded-sm flex flex-row p-4">
					<Switch
						onChange={setOwnerOnly}
						checked={ownerOnly()}
						class="flex justify-between items-center gap-x-2 w-full"
					>
						<div>
							<SwitchLabel>Owner-only</SwitchLabel>
							<SwitchDescription>
								Means only you can chat here.
							</SwitchDescription>
						</div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</Switch>
				</div>
			</Show>
			<div
				classList={{
					"opacity-50 pointer-events-none": ownerOnly(),
				}}
				class="flex flex-col gap-4"
			>
				<div class="flex flex-col gap-2">
					<div class="flex flex-row items-center w-full justify-between">
						<h4 class="m-0 font-semibold">Roles</h4>
						<Popover placement="bottom-end">
							<PopoverTrigger>
								<div class="flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm text-foreground">
									<PlusIcon />
								</div>
							</PopoverTrigger>
							<PopoverPortal>
								<PopoverContent class="p-1">
									<For
										each={nonAllowedRoles()}
										fallback={
											<span class="text-sm text-muted-foreground px-2">
												No roles found.
											</span>
										}
									>
										{(role) => {
											const manageable = () => canManageRole(user.did, role);

											return (
												<DisplayedRole
													manageable={manageable}
													role={role}
													toggleRole={addAllowedRole}
												/>
											);
										}}
									</For>
								</PopoverContent>
							</PopoverPortal>
						</Popover>
					</div>
					<For each={allowedRoles()}>
						{(roleUri) => {
							const role = community().assignableRoles.find(
								(x) => x.uri === roleUri,
							)!;
							const manageable = () => canManageRole(user.did, role);

							return (
								<DisplayedRole manageable={manageable} role={role}>
									<Button
										size="sm"
										variant="ghost"
										class="w-6 h-6 p-0! items-center flex px-0! py-0!"
										onClick={() => removeAllowedRole(roleUri)}
									>
										<XIcon />
									</Button>
								</DisplayedRole>
							);
						}}
					</For>
				</div>
				<div class="flex flex-col gap-2">
					<div class="flex flex-row items-center w-full justify-between">
						<h4 class="m-0 font-semibold">Members</h4>
						<Popover
							placement="bottom-end"
							onOpenChange={(open) => !open && setMemberSearch("")}
						>
							<PopoverTrigger>
								<div class="flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm text-foreground">
									<PlusIcon />
								</div>
							</PopoverTrigger>
							<PopoverPortal>
								<PopoverContent class="p-1 flex flex-col gap-1">
									<TextField value={memberSearch()} onChange={setMemberSearch}>
										<TextFieldInput
											placeholder="Search members..."
											autofocus
											class="h-8"
										/>
									</TextField>
									<div class="flex flex-col gap-1 max-h-64 overflow-y-auto">
										<For
											each={nonAllowedMembersByRoles()}
											fallback={
												<span class="text-sm text-muted-foreground px-2 py-1">
													No members found.
												</span>
											}
										>
											{(group) => (
												<div class="flex flex-col">
													<span class="text-sm text-muted-foreground px-2 py-1">
														{group.role.name} — {group.members.length}
													</span>
													<For each={group.members}>
														{(member) => {
															const manageable = () =>
																outranks(user.did, member.did) || isAdmin();

															return (
																<DisplayedMember
																	manageable={manageable}
																	member={member}
																	toggleMember={addAllowedUser}
																/>
															);
														}}
													</For>
												</div>
											)}
										</For>
									</div>
								</PopoverContent>
							</PopoverPortal>
						</Popover>
					</div>
					<For each={allowedMembersByRoles()}>
						{(group) => (
							<div class="flex flex-col gap-2">
								<span class="text-sm text-muted-foreground">
									{group.role.name} — {group.members.length}
								</span>
								<For each={group.members}>
									{(member) => {
										const manageable = () =>
											outranks(user.did, member.did) || isAdmin();

										return (
											<DisplayedMember manageable={manageable} member={member}>
												<Button
													size="sm"
													variant="ghost"
													class="w-6 h-6 p-0! items-center flex px-0! py-0!"
													onClick={() => removeAllowedUser(member.did)}
												>
													<XIcon />
												</Button>
											</DisplayedMember>
										);
									}}
								</For>
							</div>
						)}
					</For>
				</div>
				<Show
					when={allowedMembers().length === 0 && allowedRoles().length === 0}
				>
					<p class="text-sm text-muted-foreground text-center m-0">
						No roles or members specified. Everyone will be allowed to chat
						here!
					</p>
				</Show>
			</div>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component<{
	setOpen: Setter<boolean>;
	channel: Channel;
}> = (props) => {
	const user = useUserContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [channelNameReset, setChannelNameReset] = createSignal("");

	const isValid = () => channelNameReset() === props.channel.name;

	const deleteChannel = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.channel.delete(props.channel.uri);
			props.setOpen(false);
		} catch {
			toast.error("Failed to delete channel.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this Channel?</h3>
			<p class="m-0">
				To delete this channel, first type in the name of the channel below.{" "}
				<strong>This action cannot be undone.</strong>
			</p>
			<div class="flex flex-row gap-2 items-baseline-last">
				<TextField
					value={channelNameReset()}
					onChange={setChannelNameReset}
					validationState={isValid() ? "valid" : "invalid"}
					disabled={loading()}
				>
					<TextFieldInput
						placeholder={props.channel.name}
						maxLength={32}
						minLength={1}
						type="text"
						required
					/>
				</TextField>
				<Button
					variant="destructive"
					disabled={loading() || !isValid()}
					onClick={deleteChannel}
				>
					<Spinner
						classList={{
							hidden: !loading(),
							block: loading(),
						}}
					/>
					Delete Channel
				</Button>
			</div>
		</SettingsPage>
	);
};

export const ChannelSettingsModal: ParentComponent<{
	channel: Channel;
	class?: string;
	open?: Accessor<boolean>;
	setOpen?: Setter<boolean>;
}> = (props) => {
	const user = useUserContext();
	const {
		canDeleteChannel: _canDeleteChannel,
		canUpdateChannel: _canUpdateChannel,
	} = usePermissions();

	const [internalOpen, setInternalOpen] = createSignal(false);

	const open = () => props.open?.() ?? internalOpen();
	const setOpen: Setter<boolean> = (value) =>
		props.setOpen ? props.setOpen(value) : setInternalOpen(value);

	const canManageChannel = () => _canUpdateChannel(user.did);
	const canDeleteChannel = () => _canDeleteChannel(user.did);

	return (
		<SettingsModal
			open={open}
			setOpen={setOpen}
			pages={[
				{
					title: "General",
					id: "general",
					component: () => <GeneralChannelSettings channel={props.channel} />,
					icon: () => <WrenchIcon />,
					visible: canManageChannel,
				},
				{
					title: "Permissions",
					id: "members",
					component: () => <PermissionsPage channel={props.channel} />,
					icon: () => <ShieldIcon />,
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: () => (
					<DangerSettingsPage setOpen={setOpen} channel={props.channel} />
				),
				icon: () => <WarningDiamondIcon />,
				visible: canDeleteChannel,
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={props.channel.uri} />,
				icon: () => <BugIcon />,
			}}
		/>
	);
};

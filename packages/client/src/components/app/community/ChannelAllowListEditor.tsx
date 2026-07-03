import {
	type Accessor,
	type Component,
	createSignal,
	For,
	type ParentComponent,
	type Setter,
	Show,
} from "solid-js";
import PlusIcon from "~icons/ph/plus";
import XIcon from "~icons/ph/x";
import type { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { groupMembersByRoles } from "../../../utils/group-members-by-roles";
import { Button } from "../../ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import { TextField, TextFieldInput } from "../../ui/TextField";
import User from "../user";
import { displayableNameFn } from "../user/DisplayableName";

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

/**
 * The roles + members post allow-list editor shared by the channel settings
 * "Permissions" page and the restricted-channel step of the creation modal.
 */
export const ChannelAllowListEditor: Component<{
	allowedRoles: Accessor<string[]>;
	setAllowedRoles: Setter<string[]>;
	allowedMembers: Accessor<string[]>;
	setAllowedMembers: Setter<string[]>;
	disabled?: Accessor<boolean>;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { isAdmin: _isAdmin, canManageRole, outranks } = usePermissions();

	const isAdmin = () => _isAdmin(user.did);

	const addAllowedRole = (uri: string) =>
		props.setAllowedRoles((prev) =>
			prev.includes(uri) ? prev : [...prev, uri],
		);

	const removeAllowedRole = (uri: string) =>
		props.setAllowedRoles((prev) => prev.filter((r) => r !== uri));

	const addAllowedUser = (did: string) =>
		props.setAllowedMembers((prev) =>
			prev.includes(did) ? prev : [...prev, did],
		);

	const removeAllowedUser = (did: string) =>
		props.setAllowedMembers((prev) => prev.filter((d) => d !== did));

	// Search query for the "add member" popover; reset whenever it closes.
	const [memberSearch, setMemberSearch] = createSignal("");

	const nonAllowedRoles = () =>
		community()
			.assignableRoles.sort((a, b) => b.position - a.position)
			.filter((x) => !props.allowedRoles().some((y) => x.uri === y));

	const nonAllowedMembers = () => {
		const query = memberSearch().trim().toLowerCase();
		return community()
			.members.filter((x) => !props.allowedMembers().some((y) => x.did === y))
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
			members: props
				.allowedMembers()
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
		<div
			classList={{
				"opacity-50 pointer-events-none": props.disabled?.() ?? false,
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
				<For each={props.allowedRoles()}>
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
				when={
					props.allowedMembers().length === 0 &&
					props.allowedRoles().length === 0
				}
			>
				<p class="text-sm text-muted-foreground text-center m-0">
					No roles or members specified. Everyone will be allowed to chat here!
				</p>
			</Show>
		</div>
	);
};

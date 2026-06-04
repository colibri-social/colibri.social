import { createSignal, For, Show } from "solid-js";
import { toast } from "somoto";
import twemoji from "@twemoji/api";
import { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import createMediaQuery from "../../../utils/create-media-query";
import User from "../user";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import DotsThreeIcon from "~icons/ph/dots-three";

type MembersByRoles = Array<{
	role: Role;
	members: Array<Member>;
}>;

const RolePicker = (props: {
	member: Member;
	communityUri: string;
	roles: Role[];
	onClose: () => void;
}) => {
	const user = useUserContext();
	const [selected, setSelected] = createSignal<string[]>(props.member.roles);
	const [loading, setLoading] = createSignal(false);

	const toggle = (roleUri: string) => {
		setSelected((prev) =>
			prev.includes(roleUri)
				? prev.filter((r) => r !== roleUri)
				: [...prev, roleUri],
		);
	};

	const handleSave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.community.setMemberRoles(
				props.communityUri,
				props.member.did,
				selected(),
			);
			props.onClose();
		} catch {
			toast.error("Failed to update roles.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="flex flex-col gap-3 p-1">
			<span class="text-sm font-semibold">Change roles</span>
			<div class="flex flex-col gap-1">
				<For each={props.roles}>
					{(role) => (
						<label class="flex flex-row items-center gap-2 cursor-pointer rounded-sm px-1 py-0.5 hover:bg-muted text-sm">
							<input
								type="checkbox"
								checked={selected().includes(role.uri)}
								onChange={() => toggle(role.uri)}
								class="cursor-pointer"
							/>
							<span
								classList={{ "font-medium": selected().includes(role.uri) }}
								style={{ color: role.color ?? undefined }}
							>
								{role.name}
							</span>
						</label>
					)}
				</For>
			</div>
			<Button
				size="sm"
				onClick={handleSave}
				disabled={loading()}
				class="self-end"
			>
				Save
			</Button>
		</div>
	);
};

const MemberRow = (props: {
	member: Member;
	communityUri: string;
	roles: Role[];
}) => {
	const user = useUserContext();
	const { canManage } = usePermissions();
	const [kickOpen, setKickOpen] = createSignal(false);
	const [rolePickerOpen, setRolePickerOpen] = createSignal(false);
	const [kicking, setKicking] = createSignal(false);

	const isMe = () => props.member.did === user.did;
	const showActions = () => canManage(user.did) && !isMe();

	const handleKick = async () => {
		setKicking(true);
		try {
			await user.xrpc.social.colibri.community.kick(
				props.communityUri,
				props.member.did,
			);
			setKickOpen(false);
		} catch {
			toast.error("Failed to kick member.");
		} finally {
			setKicking(false);
		}
	};

	return (
		<>
			<User.ProfilePopover
				user={props.member}
				class="data-expanded:[&>div]:bg-muted!"
			>
				<div class="group/member flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1">
					<User.Avatar user={props.member} />
					<div class="flex flex-col w-[calc(100%-36px-8px)]">
						<span class="font-medium leading-5 overflow-hidden text-ellipsis">
							<User.DisplayableName user={props.member} />
						</span>
						<Show
							when={
								props.member.data.status &&
								props.member.data.onlineState !== "offline"
							}
						>
							<span class="text-sm w-full leading-5 flex flex-row items-center gap-2">
								<Show when={props.member.data.status!.emoji}>
									<span
										class="[&>img]:min-w-4 [&>img]:min-h-4 [&>img]:w-4 [&>img]:h-4 [&>img]inline"
										innerHTML={twemoji.parse(props.member.data.status!.emoji!)}
									/>
								</Show>
								<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
									{props.member.data.status!.text}
								</span>
							</span>
						</Show>
					</div>
					<Show when={showActions()}>
						<DropdownMenu placement="bottom-end">
							<DropdownMenuTrigger
								as="button"
								type="button"
								class="opacity-0 group-hover/member:opacity-100 ml-auto p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={(e: MouseEvent) => e.stopPropagation()}
							>
								<DotsThreeIcon />
							</DropdownMenuTrigger>
							<DropdownMenuPortal>
								<DropdownMenuContent class="min-w-36">
									<DropdownMenuItem
										onSelect={() => {
											setRolePickerOpen(true);
										}}
									>
										Change roles
									</DropdownMenuItem>
									<DropdownMenuItem
										class="text-destructive data-highlighted:text-destructive"
										onSelect={() => setKickOpen(true)}
									>
										Kick
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenuPortal>
						</DropdownMenu>
					</Show>
				</div>
			</User.ProfilePopover>

			{/* Role picker popover */}
			<Show when={showActions()}>
				<Popover
					open={rolePickerOpen()}
					onOpenChange={setRolePickerOpen}
					placement="left"
				>
					<PopoverTrigger as="span" class="hidden" />
					<PopoverPortal>
						<PopoverContent class="w-56">
							<RolePicker
								member={props.member}
								communityUri={props.communityUri}
								roles={props.roles}
								onClose={() => setRolePickerOpen(false)}
							/>
						</PopoverContent>
					</PopoverPortal>
				</Popover>

				{/* Kick confirmation */}
				<Dialog open={kickOpen()} onOpenChange={setKickOpen}>
					<DialogPortal>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									Kick {props.member.data.displayName || props.member.handle}?
								</DialogTitle>
								<DialogDescription>
									They will be removed from the community and can only rejoin
									with an invite link.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="secondary" onClick={() => setKickOpen(false)}>
									Cancel
								</Button>
								<Button
									variant="destructive"
									onClick={handleKick}
									disabled={kicking()}
								>
									Kick
								</Button>
							</DialogFooter>
						</DialogContent>
					</DialogPortal>
				</Dialog>
			</Show>
		</>
	);
};

export const MemberSidebar = () => {
	const community = useCommunityContext();

	const membersByRoles = (): MembersByRoles => {
		const result: MembersByRoles = community()
			.roles.slice()
			.sort((a, b) => a.position - b.position)
			.map((x) => ({ role: x, members: [] }));

		for (const member of community().members) {
			const sortedMemberRoles = member.roles.sort(
				(a, b) =>
					result.findIndex((y) => y.role.uri === a) -
					result.findIndex((z) => z.role.uri === b),
			);

			const highestMemberRole = sortedMemberRoles[0];
			const resultIndex = result.findIndex(
				(x) => x.role.uri === highestMemberRole,
			);

			if (resultIndex < 0) continue;

			result[resultIndex].members.push(member);
		}

		return result;
	};

	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");
	const { preferences } = useUserPreferences();

	return (
		<div
			class="min-w-72 flex w-72 h-full flex-col p-4 border-l gap-3 border-border overflow-y-auto bg-background"
			classList={{
				"absolute top-0 right-0 h-full drop-shadow-black drop-shadow-2xl":
					displayMembersAsSheet(),
				hidden: !preferences().membersListVisible,
			}}
		>
			<For each={membersByRoles()}>
				{(role) => (
					<>
						<span>
							{role.role.name} ({role.members.length})
						</span>
						<For each={role.members}>
							{(member) => (
								<MemberRow
									member={member}
									communityUri={community().community.uri}
									roles={community().roles}
								/>
							)}
						</For>
					</>
				)}
			</For>
		</div>
	);
};

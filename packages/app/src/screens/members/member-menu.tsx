import {
	copyText,
	MemberActionDialog,
	MemberContextMenu,
	MemberDrawer,
	type MemberMenuRole,
	toast,
} from "@colibri-social/ui";
import {
	createContext,
	createMemo,
	createSignal,
	type JSX,
	type ParentProps,
	Show,
	useContext,
} from "solid-js";
import { displayNameOf } from "../../data/adapters/authors";
import {
	type MemberPermissions,
	memberPermissions,
} from "../../data/member-permissions";
import { type SpaceData, useData } from "../../data/store";
import type { Did, MemberView, RoleView } from "../../data/types";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";
import { useProfileSheet } from "../profile/profile-sheet";

type Target = { did: Did; space: string };

type MemberMenuApi = {
	open: (did: string, space: string) => void;
	contextMenu: (did: string, space: string, row: JSX.Element) => JSX.Element;
};

const MemberMenuContext = createContext<MemberMenuApi>({
	open: () => {},
	contextMenu: (_did, _space, row) => row,
});

export const useMemberMenu = () => useContext(MemberMenuContext);

type Moderation = "kick" | "ban";

type MemberState = {
	space: SpaceData;
	member: MemberView;
	roles: RoleView[];
	permissions: MemberPermissions;
};

export const MemberMenuProvider = (props: ParentProps) => {
	const data = useData();
	const profileSheet = useProfileSheet();
	const [target, setTarget] = createSignal<Target>();
	const [open, setOpen] = createSignal(false);
	const [moderation, setModeration] = createSignal<Moderation>();
	const [confirming, setConfirming] = createSignal(false);

	const resolve = (
		current: Target | undefined = target(),
	): MemberState | undefined => {
		if (!current) return undefined;
		const community = data.spaceByKey(current.space);
		if (!community) return undefined;
		const space = data.space(community);
		const member = space.memberByDid(current.did);
		if (!member) return undefined;
		const roles = [...(space.roles.value() ?? [])].sort(
			(a, b) => b.position - a.position,
		);
		const permissions = memberPermissions({
			viewerDid: data.viewer.did,
			viewerIsOwner: !!community.viewer?.isOwner,
			viewerPermissions: community.viewer?.permissions ?? [],
			viewerRoles: community.viewer?.roles ?? [],
			targetDid: member.actor.did,
			targetRoles: member.roles,
			roles,
			requiresApproval: !!community.requiresApprovalToJoin,
		});
		return { space, member, roles, permissions };
	};

	let latest: MemberState | undefined;
	const state = createMemo((): MemberState | undefined => {
		const next = resolve();
		const current = target();
		if (next) latest = next;
		else if (latest?.member.actor.did !== current?.did) latest = undefined;
		return latest;
	});

	const name = () => {
		const current = state();
		return current ? displayNameOf(current.member.actor, current.member) : "";
	};

	const menuRoles = (current = state()): MemberMenuRole[] => {
		if (!current) return [];
		return current.roles
			.filter((role) => !role.protected)
			.map((role) => ({
				id: role.rkey,
				name: role.name,
				color: role.color,
				assigned: current.member.roles.includes(role.rkey),
				manageable: current.permissions.manageableRoles.has(role.rkey),
			}));
	};

	const changeRole = (id: string, assigned: boolean, current = state()) => {
		if (!current) return;
		const roles = current.member.roles.filter((rkey) => rkey !== id);
		if (assigned) roles.push(id);
		current.space
			.setMemberRoles(current.member.actor.did, roles)
			.catch(() => toast.error("Couldn't update roles"));
	};

	const confirmModeration = async () => {
		const current = state();
		const kind = moderation();
		if (!current || !kind) return;
		const label = name();
		try {
			await current.space[kind](current.member.actor.did);
			setConfirming(false);
			setOpen(false);
			toast.success(kind === "kick" ? `Kicked ${label}` : `Banned ${label}`);
		} catch (error) {
			toast.error(kind === "kick" ? "Couldn't kick" : "Couldn't ban");
			throw error;
		}
	};

	const askModeration = (kind: Moderation) => {
		setModeration(kind);
		void whenOverlaysClosed().then(() => setConfirming(true));
	};

	const DesktopMenu = (props: { target: Target; children: JSX.Element }) => {
		const current = createMemo(() => resolve(props.target));
		const label = () => {
			const value = current();
			return value ? displayNameOf(value.member.actor, value.member) : "";
		};
		const moderate = (kind: Moderation) => {
			setTarget(props.target);
			askModeration(kind);
		};
		return (
			<MemberContextMenu
				name={label()}
				disabled={!current()}
				onViewProfile={() =>
					profileSheet.open(props.target.did, props.target.space)
				}
				roles={menuRoles(current())}
				onRoleChange={(id, assigned) => changeRole(id, assigned, current())}
				onKick={
					current()?.permissions.canKick ? () => moderate("kick") : undefined
				}
				onBan={
					current()?.permissions.canBan ? () => moderate("ban") : undefined
				}
				onCopyDid={() =>
					void copyText(props.target.did).then(() =>
						toast.success(`DID for ${label()} copied`),
					)
				}
			>
				{props.children}
			</MemberContextMenu>
		);
	};

	const api: MemberMenuApi = {
		open: (did, space) => {
			setTarget({ did: did as Did, space });
			void whenOverlaysClosed().then(() => setOpen(true));
		},
		contextMenu: (did, space, row) => (
			<DesktopMenu target={{ did: did as Did, space }}>{row}</DesktopMenu>
		),
	};

	return (
		<MemberMenuContext.Provider value={api}>
			{props.children}
			<Show when={state()}>
				{(current) => (
					<>
						<MemberDrawer
							open={open()}
							onOpenChange={setOpen}
							name={name()}
							handle={current().member.actor.handle}
							avatarSrc={current().member.actor.avatar}
							avatarSeed={current().member.actor.did}
							onViewProfile={() => {
								const value = target();
								if (value) profileSheet.open(value.did, value.space);
							}}
							roles={menuRoles()}
							onRoleChange={changeRole}
							onKick={
								current().permissions.canKick
									? () => askModeration("kick")
									: undefined
							}
							onBan={
								current().permissions.canBan
									? () => askModeration("ban")
									: undefined
							}
							onCopyDid={() =>
								void copyText(current().member.actor.did).then(() =>
									toast.success(`DID for ${name()} copied`),
								)
							}
						/>
						<Show when={moderation()}>
							{(kind) => (
								<MemberActionDialog
									open={confirming()}
									onOpenChange={setConfirming}
									kind={kind()}
									name={name()}
									requiresApproval={
										!!current().space.community.requiresApprovalToJoin
									}
									onConfirm={confirmModeration}
								/>
							)}
						</Show>
					</>
				)}
			</Show>
		</MemberMenuContext.Provider>
	);
};

import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { UserBlockRoundedIcon } from "@solar-icons/solid/bold/user-block-rounded";
import { UserCircleIcon } from "@solar-icons/solid/bold/user-circle";
import { UserMinusRoundedIcon } from "@solar-icons/solid/bold/user-minus-rounded";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createEffect,
	createMemo,
	createSignal,
	Index,
	on,
	Show,
} from "solid-js";
import { Avatar } from "../Avatar/Avatar";
import {
	assignedRoleCount,
	canEditMemberRoles,
	type MemberMenuActions,
} from "../ContextMenu/MemberMenu";
import {
	DeveloperModeCard,
	type DeveloperModeCardProps,
} from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import { CheckboxRow, DestructiveRow, ListGroup, NavRow } from "../List/List";
import { RoleColorDot } from "../Roles/RoleBadge";
import { memberHandleLabel } from "./MemberIdentity";

export type MemberDrawerView = "actions" | "roles";

export type MemberDrawerProps = MemberMenuActions & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	handle?: string;
	avatarSrc?: string;
	avatarSeed?: string;
	developer?: DeveloperModeCardProps;
};

export const MemberDrawer = (props: MemberDrawerProps) => {
	const [view, setView] = createSignal<MemberDrawerView>("actions");

	const open = createMemo(() => props.open);
	createEffect(
		on(open, (isOpen) => {
			if (isOpen) setView("actions");
		}),
	);

	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const backToActions = (event: KeyboardEvent) => {
		if (view() !== "roles") return;
		event.preventDefault();
		event.stopPropagation();
		setView("actions");
	};
	const hasPrimary = () => !!props.onViewProfile || canEditMemberRoles(props);
	const hasModeration = () => !!(props.onKick || props.onBan);
	const roleCount = () => assignedRoleCount(props);
	const showDeveloper = () => !!(props.developerMode && props.developer);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<DrawerContent
				aria-label={`${props.name} options`}
				onEscapeKeyDown={backToActions}
				header={
					<Show
						when={view() === "roles"}
						fallback={
							<div
								data-member-drawer-header=""
								class="flex min-w-0 items-center gap-3"
							>
								<Avatar
									src={props.avatarSrc}
									name={props.name}
									seed={props.avatarSeed}
									size="md"
								/>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="min-w-0 truncate text-lg leading-6 font-bold">
										{props.name}
									</span>
									<Show when={props.handle}>
										{(handle) => (
											<span class="min-w-0 truncate text-sm text-muted-foreground">
												{memberHandleLabel(handle())}
											</span>
										)}
									</Show>
								</span>
							</div>
						}
					>
						<div
							data-member-drawer-header=""
							class="flex min-w-0 items-center gap-2"
						>
							<IconButton
								variant="ghost"
								size="md"
								label="Back to member options"
								icon={<ArrowLeftIcon />}
								onClick={() => setView("actions")}
								class="-ml-1.5 [&_svg]:size-5"
							/>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-base leading-5 font-bold">Roles</span>
								<span class="min-w-0 truncate text-sm text-muted-foreground">
									{props.name}
								</span>
							</span>
						</div>
					</Show>
				}
			>
				<Show when={view() === "roles"}>
					<ListGroup>
						<Index each={props.roles ?? []}>
							{(role) => (
								<CheckboxRow
									leading={<RoleColorDot color={role().color} />}
									label={<span class="block truncate">{role().name}</span>}
									checked={role().assigned}
									disabled={!role().manageable}
									onChange={(checked) =>
										props.onRoleChange?.(role().id, checked)
									}
									class="min-h-12"
								/>
							)}
						</Index>
					</ListGroup>
				</Show>
				<Show when={view() === "actions"}>
					<Show when={hasPrimary()}>
						<ListGroup>
							<Show when={props.onViewProfile}>
								<NavRow
									icon={<UserCircleIcon />}
									label="View profile"
									onClick={run(props.onViewProfile)}
								/>
							</Show>
							<Show when={canEditMemberRoles(props)}>
								<NavRow
									icon={<ShieldUserIcon />}
									label="Roles"
									value={roleCount() > 0 ? String(roleCount()) : undefined}
									onClick={() => setView("roles")}
								/>
							</Show>
						</ListGroup>
					</Show>
					<Show when={hasModeration()}>
						<ListGroup>
							<Show when={props.onKick}>
								<DestructiveRow
									icon={<UserMinusRoundedIcon />}
									label={`Kick ${props.name}`}
									onClick={run(props.onKick)}
								/>
							</Show>
							<Show when={props.onBan}>
								<DestructiveRow
									icon={<UserBlockRoundedIcon />}
									label={`Ban ${props.name}`}
									onClick={run(props.onBan)}
								/>
							</Show>
						</ListGroup>
					</Show>
					<Show when={props.onCopyDid && !showDeveloper()}>
						<ListGroup>
							<NavRow
								icon={<CopyIcon />}
								label="Copy DID"
								onClick={run(props.onCopyDid)}
							/>
						</ListGroup>
					</Show>
					<Show when={showDeveloper() && props.developer}>
						{(developer) => <DeveloperModeCard {...developer()} />}
					</Show>
				</Show>
			</DrawerContent>
		</Drawer>
	);
};

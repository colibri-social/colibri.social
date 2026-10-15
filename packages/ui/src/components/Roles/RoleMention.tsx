import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import {
	isInsideNestedLayer,
	revealLayer,
	topLayerAttrs,
} from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { groupMembers, type Member, MemberList } from "../Members/MemberList";
import type { MemberRowVariant } from "../Members/MemberRow";
import { MemberRowSkeleton } from "../Members/MemberSkeletons";
import { ChipButton, chipButtonClass } from "../RichText/ChipButton";
import { RoleBadge, type RoleIdentity } from "./RoleBadge";

export const ROLE_MENTION_WIDTH = 320;

export type RoleMentionData = {
	role: RoleIdentity;
	members?: Member[];
	memberCount?: number;
};

export type RoleMentionProps = RoleMentionData & {
	platform?: "mobile" | "desktop";
	onOpenMember?: (member: Member, event: MouseEvent) => void;
	onMemberMenu?: (member: Member, event: Event) => void;
	wrapMember?: (member: Member, row: JSX.Element) => JSX.Element;
	children: JSX.Element;
};

const countLabel = (total: number, online: number) =>
	`${total} ${total === 1 ? "member" : "members"} · ${online} online`;

export const RoleMentionHeader = (props: RoleMentionData) => {
	const total = () => props.memberCount ?? props.members?.length ?? 0;
	const online = () =>
		props.members?.filter((member) => member.presence !== "offline").length ??
		0;
	return (
		<div data-role-mention-header="" class="flex min-w-0 flex-col gap-0.5">
			<span class="flex min-w-0 items-center gap-1.5">
				<Show when={props.role.badge}>
					<RoleBadge role={props.role} />
				</Show>
				<span
					class="min-w-0 truncate text-base leading-5 font-bold"
					style={props.role.color ? { color: props.role.color } : undefined}
				>
					{props.role.name}
				</span>
			</span>
			<Show
				when={props.members}
				fallback={<span class="h-4 w-28 animate-pulse rounded bg-muted" />}
			>
				<span class="text-xs text-muted-foreground tabular-nums">
					{countLabel(total(), online())}
				</span>
			</Show>
		</div>
	);
};

export const RoleMentionMembers = (
	props: RoleMentionData & {
		variant: MemberRowVariant;
		onOpenMember?: (member: Member, event: MouseEvent) => void;
		onMemberMenu?: (member: Member, event: Event) => void;
		wrapMember?: (member: Member, row: JSX.Element) => JSX.Element;
	},
) => {
	const groups = createMemo(() =>
		props.members ? groupMembers(props.members) : undefined,
	);
	return (
		<Show
			when={groups()}
			fallback={
				<div
					class={cx(
						"flex flex-col",
						props.variant === "mobile" &&
							"overflow-hidden rounded-surface bg-popover-highlight",
					)}
				>
					<For each={[0, 1, 2, 3]}>
						{() => <MemberRowSkeleton variant={props.variant} />}
					</For>
				</div>
			}
		>
			{(list) => (
				<Show
					when={list().length > 0}
					fallback={
						<p class="m-0 px-2 py-6 text-center text-sm text-muted-foreground">
							No one has this role yet.
						</p>
					}
				>
					<MemberList
						groups={list()}
						variant={props.variant}
						onOpen={props.onOpenMember}
						onMemberMenu={props.onMemberMenu}
						wrapMember={props.wrapMember}
						class={props.variant === "desktop" ? "px-0 py-0" : undefined}
					/>
				</Show>
			)}
		</Show>
	);
};

const RoleMentionPopover = (props: RoleMentionProps) => {
	const overflowPadding = usePopperOverflowPadding(16);
	const [open, setOpen] = createSignal(false);
	let content: HTMLDivElement | undefined;
	const keepForNestedLayer = (
		event: Event & { detail?: { originalEvent?: Event } },
	) => {
		const target = event.detail?.originalEvent?.target ?? event.target;
		if (
			target instanceof Node &&
			!content?.contains(target) &&
			isInsideNestedLayer(target)
		) {
			event.preventDefault();
		}
	};
	return (
		<KobaltePopover
			open={open()}
			onOpenChange={setOpen}
			placement="top-start"
			gutter={6}
			flip
			modal={false}
			overflowPadding={overflowPadding()}
		>
			<KobaltePopover.Trigger
				as="button"
				type="button"
				data-chip-button=""
				aria-label={`Show members of ${props.role.name}`}
				class={chipButtonClass}
			>
				{props.children}
			</KobaltePopover.Trigger>
			<KobaltePopover.Portal>
				<KobaltePopover.Content
					{...topLayerAttrs}
					ref={(element: HTMLDivElement) => {
						content = element;
						revealLayer(element);
					}}
					onInteractOutside={keepForNestedLayer}
					onFocusOutside={keepForNestedLayer}
					data-role-mention-popover=""
					aria-label={`${props.role.name} members`}
					class="modal-motion z-50 flex flex-col overflow-hidden rounded-surface border border-border bg-popover text-foreground shadow-overlay outline-none origin-(--kb-popover-content-transform-origin)"
					style={{
						width: `${ROLE_MENTION_WIDTH}px`,
						"max-height":
							"min(420px, var(--kb-popper-content-available-height, 80vh))",
					}}
				>
					<div class="border-b border-border px-3 py-2.5">
						<RoleMentionHeader
							role={props.role}
							members={props.members}
							memberCount={props.memberCount}
						/>
					</div>
					<div class="min-h-0 overflow-y-auto overscroll-contain p-1.5 [&_[data-member-row]:hover]:bg-popover-highlight">
						<RoleMentionMembers
							role={props.role}
							members={props.members}
							variant="desktop"
							onOpenMember={props.onOpenMember}
							onMemberMenu={props.onMemberMenu}
							wrapMember={props.wrapMember}
						/>
					</div>
				</KobaltePopover.Content>
			</KobaltePopover.Portal>
		</KobaltePopover>
	);
};

const RoleMentionDrawer = (props: RoleMentionProps) => {
	const [open, setOpen] = createSignal(false);
	return (
		<>
			<ChipButton
				label={`Show members of ${props.role.name}`}
				onClick={() => setOpen(true)}
			>
				{props.children}
			</ChipButton>
			<Drawer open={open()} onOpenChange={setOpen} initialFocus="content">
				<DrawerContent
					aria-label={`${props.role.name} members`}
					header={
						<RoleMentionHeader
							role={props.role}
							members={props.members}
							memberCount={props.memberCount}
						/>
					}
				>
					<RoleMentionMembers
						role={props.role}
						members={props.members}
						variant="mobile"
						onOpenMember={(member, event) => {
							setOpen(false);
							props.onOpenMember?.(member, event);
						}}
						onMemberMenu={(member, event) => {
							setOpen(false);
							props.onMemberMenu?.(member, event);
						}}
					/>
				</DrawerContent>
			</Drawer>
		</>
	);
};

export const RoleMention = (props: RoleMentionProps) => (
	<Show
		when={props.platform === "desktop"}
		fallback={<RoleMentionDrawer {...props} />}
	>
		<RoleMentionPopover {...props} />
	</Show>
);

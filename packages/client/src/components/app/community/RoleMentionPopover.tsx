import {
	type Component,
	createSignal,
	For,
	type ParentComponent,
	Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import CrownIcon from "~icons/ph/crown-fill";
import type { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import { useCommunityContext } from "../../../contexts/Community";
import { useIsMobile } from "../../../utils/mobile-pane";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import User from "../user";
import { MemberContextMenu } from "./MemberContextMenu";

/**
 * The list of members holding a role, shown when a `@role` mention is clicked
 */
const RolePopoverContents: Component<{ role: Role; class?: string }> = (
	props,
) => {
	const community = useCommunityContext();

	const members = () =>
		community()
			.members.filter((member) => member.roles.includes(props.role.uri))
			.sort((a, b) => {
				const owner = community().ownerDid();
				if (a.did === owner) return -1;
				if (b.did === owner) return 1;
				return 0;
			});

	return (
		<div class={`flex flex-col p-2 ${props.class ?? ""}`}>
			<span class="text-xs text-muted-foreground px-2 py-1 flex flex-row items-center gap-1.5">
				{props.role.name} — {members().length}
			</span>
			<div class="flex flex-col max-h-64 overflow-y-auto">
				<For each={members()}>
					{(member) => (
						<MemberContextMenu member={member}>
							<User.ProfilePopover
								user={member}
								placement="right"
								class="data-expanded:[&>div]:bg-muted!"
							>
								<div
									class="flex flex-row items-center gap-2 px-2 py-1 rounded-sm hover:bg-muted/50 cursor-pointer"
									onPointerDown={(e) => e.button !== 0 && e.stopPropagation()}
								>
									<User.Avatar user={member} size="small" />
									<span class="text-sm leading-5 flex flex-row items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
										<User.DisplayableName user={member} />
										<Show when={community().ownerDid() === member.did}>
											<CrownIcon class="text-yellow-400 w-3.5 h-3.5 shrink-0" />
										</Show>
									</span>
								</div>
							</User.ProfilePopover>
						</MemberContextMenu>
					)}
				</For>
			</div>
		</div>
	);
};

export const RoleMentionPopover: ParentComponent<{
	role: Role;
	class?: string;
	as?: "div" | "span";
}> = (props) => {
	const isMobile = useIsMobile();
	const [open, setOpen] = createSignal(false);

	return (
		<Show
			when={isMobile()}
			fallback={
				<Popover preventScroll placement="right" gutter={16} flip>
					<PopoverTrigger as={props.as ?? "span"} class={props.class}>
						{props.children}
					</PopoverTrigger>
					<PopoverPortal>
						<PopoverContent class="w-64 p-0 overflow-hidden relative drop-shadow-black drop-shadow-xl">
							<RolePopoverContents role={props.role} />
						</PopoverContent>
					</PopoverPortal>
				</Popover>
			}
		>
			<Dynamic
				component={props.as ?? "span"}
				class={props.class}
				onClick={() => setOpen(true)}
			>
				{props.children}
			</Dynamic>
			<BottomSheet
				open={open()}
				onOpenChange={setOpen}
				handleOverlay
				class="overflow-hidden"
			>
				<div class="min-h-0 overflow-y-auto pb-[calc(0.75rem+var(--safe-area-bottom))]">
					<RolePopoverContents class="w-full" role={props.role} />
				</div>
			</BottomSheet>
		</Show>
	);
};

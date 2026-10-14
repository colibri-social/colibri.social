import {
	ChannelInfoBar,
	ChannelInfoSummary,
	groupMembers,
	MemberList,
	MemberRowSkeleton,
} from "@colibri-social/ui";
import { createMemo, For, type JSX, Show } from "solid-js";
import { useData } from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import { LoadErrorState } from "../../shell/load-error";
import { useStack } from "../../shell/stack";
import { canInSpace } from "../admin/space-admin";
import { ConversationUnavailable } from "../channel/conversation";
import { type ProfileAnchor, useProfileSheet } from "../profile/profile-sheet";
import { hoistedRoles, toListMember } from "./member-adapter";
import { useMemberMenu } from "./member-menu";

export type MembersArgs = { space: string; channel: string };

export const members = defineContract({
	id: "members",
	model: (args: MembersArgs) => {
		const data = useData();
		const stack = useStack();
		const profileSheet = useProfileSheet();
		const memberMenu = useMemberMenu();
		const community = () => data.spaceByKey(args.space);
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const channel = createMemo(() => space()?.channelBySlug(args.channel));
		const unavailable = createMemo<"space" | "channel" | undefined>(() => {
			if (data.communities.loading()) return undefined;
			const current = space();
			if (!current) return "space";
			if (current.channels.loading() || current.channels.error()) {
				return undefined;
			}
			return channel() ? undefined : "channel";
		});
		const muted = () => {
			const ref = channel()?.space;
			return ref ? data.isMuted(ref) : false;
		};
		const setMuted = (next: boolean) => {
			const ref = channel()?.space;
			if (ref) data.setMuted(ref, next);
		};
		const ownerRole = () =>
			space()
				?.roles.value()
				?.find((role) => role.protected)?.rkey;
		const groups = createMemo(() => {
			const current = space();
			const list = current?.members.value();
			if (!current || !list) return undefined;
			const mapped = list.map((member) =>
				toListMember(member, {
					roleByKey: current.roleByKey,
					presence: data.presenceOf(member.actor.did),
					ownerRole: ownerRole(),
				}),
			);
			return groupMembers(mapped, hoistedRoles(current.roles.value() ?? []));
		});
		const loadError = () => {
			const current = space();
			return current?.members.value() ? undefined : current?.members.error();
		};
		const retryMembers = () => space()?.members.retry();
		return {
			unavailable,
			loadError,
			retryMembers,
			args,
			stack,
			channel,
			groups,
			muted,
			setMuted,
			openSettings: () => {
				if (!canInSpace(community(), "channel.update")) return undefined;
				return () =>
					stack.push({
						kind: "admin",
						space: args.space,
						page: "channel",
						id: args.channel,
					});
			},
			openProfile: (did: string, anchor?: ProfileAnchor) =>
				profileSheet.open(did, args.space, anchor),
			openMemberMenu: (did: string) => memberMenu.open(did, args.space),
			memberContextMenu: (did: string, row: JSX.Element) =>
				memberMenu.contextMenu(did, args.space, row),
		};
	},
	slots: {
		Bar: slot((m) => (
			<ChannelInfoBar
				safeTop
				onBack={() => m.stack.pop()}
				backLabel={`Back to #${m.channel()?.name ?? m.args.channel}`}
				muted={m.muted()}
				onMutedChange={m.setMuted}
				onOpenSettings={m.openSettings()}
			/>
		)),
		Info: slot((m) => (
			<ChannelInfoSummary
				name={m.channel()?.name ?? m.args.channel}
				description={m.channel()?.description}
			/>
		)),
		Unavailable: slot((m) => (
			<Show when={m.unavailable()}>
				{(kind) => (
					<ConversationUnavailable
						kind={kind()}
						actionLabel="Back to channels"
						onAction={() => m.stack.popTo(0)}
					/>
				)}
			</Show>
		)),
		List: slot((m, props: { variant?: "mobile" | "desktop" }) => {
			const desktop = () => props.variant === "desktop";
			const loading = () => (
				<Show
					when={m.loadError()}
					fallback={
						<Show
							when={desktop()}
							fallback={
								<div class="flex flex-col overflow-hidden rounded-surface bg-popover-highlight">
									<For each={Array.from({ length: 8 }, (_, index) => index)}>
										{() => <MemberRowSkeleton variant="mobile" />}
									</For>
								</div>
							}
						>
							<div class="flex flex-col px-2 py-4">
								<For each={Array.from({ length: 12 }, (_, index) => index)}>
									{() => <MemberRowSkeleton variant="desktop" />}
								</For>
							</div>
						</Show>
					}
				>
					{(error) => (
						<LoadErrorState
							variant="inline"
							title="Members didn't load"
							error={error()}
							onRetry={m.retryMembers}
						/>
					)}
				</Show>
			);
			return (
				<Show when={m.groups()} fallback={loading()}>
					{(groups) => (
						<Show
							when={desktop()}
							fallback={
								<MemberList
									groups={groups()}
									variant="mobile"
									onOpen={(member) => m.openProfile(member.id)}
									onMemberMenu={(member) => m.openMemberMenu(member.id)}
								/>
							}
						>
							<MemberList
								groups={groups()}
								variant="desktop"
								onOpen={(member, event) =>
									m.openProfile(member.id, {
										element: event.currentTarget as HTMLElement,
										placement: "left-start",
									})
								}
								wrapMember={(member, row) =>
									m.memberContextMenu(member.id, row)
								}
							/>
						</Show>
					)}
				</Show>
			);
		}),
	},
});

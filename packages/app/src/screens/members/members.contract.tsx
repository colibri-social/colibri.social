import {
	ChannelInfoBar,
	ChannelInfoSummary,
	groupMembers,
	type Member,
	type MemberGroup,
	MemberList,
	MemberRowSkeleton,
} from "@colibri-social/ui";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import {
	createComputed,
	createEffect,
	createMemo,
	For,
	type JSX,
	on,
	Show,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useBadges } from "../../data/badges";
import {
	canReadChannel,
	isAdminRoleSet,
} from "../../data/category-permissions";
import { isVoiceChannel, skeyOf } from "../../data/ids";
import { useData } from "../../data/store";
import type { Did } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { LoadErrorState } from "../../shell/load-error";
import { useStack } from "../../shell/stack";
import { canInSpace } from "../admin/space-admin";
import { ConversationUnavailable } from "../channel/conversation";
import { type ProfileAnchor, useProfileSheet } from "../profile/profile-sheet";
import { hoistedRoles, toListMember } from "./member-adapter";
import { useMemberMenu } from "./member-menu";

const voiceIcon = (channel: { type: string } | undefined) =>
	channel && isVoiceChannel(channel) ? <VolumeSmallIcon /> : undefined;

export type MembersArgs = { space: string; channel: string; thread?: string };

export const members = defineContract({
	id: "members",
	model: (args: MembersArgs) => {
		const data = useData();
		const stack = useStack();
		const profileSheet = useProfileSheet();
		const memberMenu = useMemberMenu();
		const badges = useBadges();
		const community = () => data.spaceByKey(args.space);
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const channel = createMemo(() => space()?.channelBySlug(args.channel));
		const thread = createMemo(() => {
			const key = args.thread;
			const ref = channel()?.space;
			if (!key || !ref) return undefined;
			return data
				.channel(ref)
				.threads.value()
				?.find((entry) => skeyOf(entry.space) === key);
		});
		const roster = createMemo(() => {
			const current = thread();
			return current ? data.threadMembersOf(current.space) : undefined;
		});
		createEffect(
			on(roster, (current) => {
				void current?.refresh();
			}),
		);
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
			const view = channel();
			if (!current || !list || !view) return undefined;
			const roles = current.roles.value() ?? [];
			const category = view.category
				? current.categories
						.value()
						?.find((entry) => entry.rkey === view.category)
				: undefined;
			const threadMembers = args.thread ? roster()?.value() : undefined;
			if (args.thread && !threadMembers) return undefined;
			const included = threadMembers
				? new Set<string>(threadMembers)
				: undefined;
			const readers = list.filter((member) =>
				included
					? included.has(member.actor.did)
					: canReadChannel(view, category, {
							did: member.actor.did,
							roles: member.roles ?? [],
							admin: isAdminRoleSet(member.roles ?? [], roles),
						}),
			);
			const mapped = readers.map((member) =>
				toListMember(member, {
					roleByKey: current.roleByKey,
					presence: data.presenceOf(member.actor.did),
					ownerRole: ownerRole(),
					emoji: data.emoji,
				}),
			);
			return groupMembers(mapped, hoistedRoles(current.roles.value() ?? []));
		});
		const [listed, setListed] = createStore<{ groups?: MemberGroup[] }>({});
		createComputed(() => {
			const next = groups();
			setListed("groups", next ? reconcile(next, { key: "id" }) : undefined);
		});
		const loadError = () => {
			const current = space();
			const membersError = current?.members.value()
				? undefined
				: current?.members.error();
			const list = roster();
			return membersError ?? (list?.value() ? undefined : list?.error());
		};
		const retryMembers = () => {
			space()?.members.retry();
			roster()?.retry();
		};
		return {
			unavailable,
			loadError,
			retryMembers,
			args,
			stack,
			channel,
			groups: () => listed.groups,
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
			badgeOf: (member: Member) => {
				const actor = space()?.memberByDid(member.id as Did)?.actor;
				return actor ? badges.primary(actor, { withoutBot: true }) : undefined;
			},
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
				icon={voiceIcon(m.channel())}
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
									badgeOf={m.badgeOf}
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
								badgeOf={m.badgeOf}
							/>
						</Show>
					)}
				</Show>
			);
		}),
	},
});

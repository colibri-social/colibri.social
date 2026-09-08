import { useLocation } from "@solidjs/router";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import CaretLeftIcon from "~icons/ph/caret-left";
import CrownIcon from "~icons/ph/crown-fill";
import { activityIsLive, activitySummary } from "../../../atproto/activity";
import { parseThreadPath } from "../../../atproto/colibri-channel-url";
import { spaceSkey } from "../../../atproto/space-ref";
import { useCommunityContext } from "../../../contexts/Community";
import type { Member } from "../../../contexts/community-payload";
import { useThreads } from "../../../contexts/Threads";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { channelAudience } from "../../../utils/channel-audience";
import { createSwipe } from "../../../utils/create-swipe";
import { parseEmojiText } from "../../../utils/emoji";
import { getChannelParam } from "../../../utils/get-param";
import { groupMembersByRoles } from "../../../utils/group-members-by-roles";
import {
	createMobilePane,
	PANE_COMMIT_RATIO,
} from "../../../utils/mobile-pane";
import { isDrawerOpen } from "../../ui/MenuDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";
import User from "../user";
import { ActivityIcon } from "../user/ActivityCard";
import { MemberContextMenu } from "./MemberContextMenu";

// Exact row geometry, so the window never has to measure the DOM.
const ROW_GAP = 12; // was `gap-3` on the flex column
const MEMBER_HEIGHT = 48; // `h-12`
const HEADER_HEIGHT = 20; // one line of `text-sm`
const HEADER_TOP_GAP = 16; // was `not-first-of-type:mt-4`
const OVERSCAN = 6; // rows rendered beyond each edge of the viewport

type Row =
	| {
			kind: "header";
			key: string;
			label: string;
			count: number;
			size: number;
			spaced: boolean;
	  }
	| { kind: "member"; key: string; member: Member; size: number };

const MemberRow = (props: { member: Member }) => {
	const community = useCommunityContext();
	const profile = () => props.member.actor;
	const online = () => props.member.data.onlineState !== "offline";
	const activity = () => {
		const current = props.member.data.activity;
		return activityIsLive(current) ? current : undefined;
	};

	return (
		<MemberContextMenu member={props.member}>
			<User.ProfilePopover
				user={profile()}
				nickname={props.member.nickname}
				class="data-expanded:[&>div]:bg-muted!"
			>
				<div
					class="group/member flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1"
					onPointerDown={(e) => e.button !== 0 && e.stopPropagation()}
				>
					<User.Avatar user={profile()} nickname={props.member.nickname} />
					<div class="flex flex-col w-[calc(100%-36px-8px)] min-w-0">
						<span class="font-medium leading-5 flex flex-row items-center gap-2">
							<User.DisplayableName
								badge={false}
								user={profile()}
								nickname={props.member.nickname}
								className="min-w-0"
							/>
							<Show when={community().ownerDid() === props.member.did}>
								<span class="shrink-0 flex">
									<Tooltip>
										<TooltipTrigger>
											<CrownIcon class="text-yellow-400 w-4 h-4" />
										</TooltipTrigger>
										<TooltipContent>Community Owner</TooltipContent>
									</Tooltip>
								</span>
							</Show>
						</span>
						<Show when={online() && (activity() || props.member.data.status)}>
							<span class="text-sm w-full leading-5 flex flex-row items-center gap-2">
								<Show when={activity()}>
									{(current) => (
										<>
											<span class="text-purple-400 shrink-0 flex items-center">
												<ActivityIcon kind={current().kind} />
											</span>
											<Show when={props.member.data.status}>
												<span class="text-muted-foreground shrink-0">·</span>
											</Show>
										</>
									)}
								</Show>
								<Show
									when={props.member.data.status}
									fallback={
										<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
											{activitySummary(activity()!)}
										</span>
									}
								>
									{(status) => (
										<>
											<Show when={status().emoji}>
												<span
													class="[&>img]:min-w-4 [&>img]:min-h-4 [&>img]:w-4 [&>img]:h-4 [&>img]inline"
													innerHTML={parseEmojiText(status().emoji!)}
												/>
											</Show>
											<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
												{status().text}
											</span>
										</>
									)}
								</Show>
							</span>
						</Show>
					</div>
				</div>
			</User.ProfilePopover>
		</MemberContextMenu>
	);
};

export const MemberSidebar = () => {
	const community = useCommunityContext();
	const threads = useThreads();
	const location = useLocation();

	const currentChannel = createMemo(() => {
		const skey = getChannelParam();
		if (!skey) return undefined;
		return community().channels.find((c) => spaceSkey(c.space) === skey);
	});

	const currentThread = createMemo(() => {
		const space = parseThreadPath(location.pathname)?.threadSpace;
		return space === undefined ? undefined : threads.bySpace(space);
	});

	const visibleMembers = createMemo(() => {
		const audience = {
			roles: community().roles,
			ownerDid: community().ownerDid(),
		};

		const channel = currentChannel();
		const inChannel = channel
			? channelAudience(community().members, { ...audience, channel })
			: community().members;

		const thread = currentThread();
		return thread
			? channelAudience(inChannel, { ...audience, channel: thread })
			: inChannel;
	});

	const membersByRoles = () =>
		groupMembersByRoles({
			members: visibleMembers(),
			assignableRoles: community().assignableRoles,
			roles: community().roles,
		});

	// Flatten the grouped roster into a windowed list. Every row's height is known
	// up front — member rows are a fixed `h-12`, group headers a single line of
	// `text-sm` — so the offsets can be prefix-summed and nothing needs measuring
	// after layout.
	const layout = createMemo(() => {
		const groups = membersByRoles().filter((g) => g.members.length > 0);
		const result: Row[] = [];

		for (const group of groups) {
			const first = result.length === 0;
			result.push({
				kind: "header",
				key: `header:${group.role.rkey || group.role.name}`,
				label: group.role.name,
				count: group.members.length,
				size: HEADER_HEIGHT + ROW_GAP + (first ? 0 : HEADER_TOP_GAP),
				spaced: !first,
			});

			for (const member of group.members) {
				result.push({
					kind: "member",
					key: member.did,
					member,
					size: MEMBER_HEIGHT + ROW_GAP,
				});
			}
		}

		// Running offsets, so `offsets[i]` is where row `i` starts and the last
		// entry is the full scroll height.
		const offsets = new Array<number>(result.length + 1);
		offsets[0] = 0;
		for (let i = 0; i < result.length; i++) {
			offsets[i + 1] = offsets[i] + result[i].size;
		}

		return { rows: result, offsets, total: offsets[result.length] };
	});

	const { preferences } = useUserPreferences();
	const {
		isMobile,
		popPane,
		pushDeeper,
		updateDrag,
		paneTranslate,
		isDragging,
	} = createMobilePane();

	const [viewport, setViewport] = createSignal({ top: 0, height: 0 });

	// A community can hold hundreds of members, and every row carries a context
	// menu, a profile popover and an avatar. Rendering them all kept the whole
	// roster live inside a permanently composited full-viewport layer, which is
	// what made the pane swipe stutter once the sidebar had been opened.
	const attachScroller = (el: HTMLDivElement) => {
		const sync = () =>
			setViewport({ top: el.scrollTop, height: el.clientHeight });

		sync();
		el.addEventListener("scroll", sync, { passive: true });
		// The sidebar is laid out off-screen and, on desktop, toggled with
		// `display: none`, so its height only becomes real after this runs.
		const observer = new ResizeObserver(sync);
		observer.observe(el);

		onCleanup(() => {
			el.removeEventListener("scroll", sync);
			observer.disconnect();
		});
	};

	const visible = createMemo(() => {
		const { rows, offsets } = layout();
		if (rows.length === 0) return [];
		const { top, height } = viewport();

		// First row whose bottom edge is past the top of the viewport.
		let lo = 0;
		let hi = rows.length - 1;
		let first = rows.length - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (offsets[mid + 1] <= top) {
				lo = mid + 1;
			} else {
				first = mid;
				hi = mid - 1;
			}
		}

		let last = first;
		while (last < rows.length - 1 && offsets[last + 1] < top + height) last++;

		const from = Math.max(0, first - OVERSCAN);
		const to = Math.min(rows.length - 1, last + OVERSCAN);

		const window: Array<{ key: string; row: Row; start: number }> = [];
		for (let i = from; i <= to; i++) {
			window.push({ key: rows[i].key, row: rows[i], start: offsets[i] });
		}
		return window;
	});

	// Iterate over the visible *keys* rather than the window entries. Keys are
	// strings, so `<For>` reuses a row's DOM and component state for as long as
	// that key stays on screen — which is what keeps an open context menu or
	// profile popover (and the Kobalte body pointer lock) alive across a
	// `roles_updated` event that reorders the roster.
	const visibleKeys = createMemo(() => visible().map((entry) => entry.key));

	const rowByKey = createMemo(
		() => new Map(visible().map((entry) => [entry.key, entry.row] as const)),
	);

	const placementByKey = createMemo(
		() => new Map(visible().map((entry) => [entry.key, entry.start] as const)),
	);

	return (
		<div
			ref={(el) =>
				createSwipe(el, {
					enabled: () => isMobile() && !isDrawerOpen(),
					commitRatio: PANE_COMMIT_RATIO,
					onSwipeRight: () => popPane(),
					onSwipeLeft: () => pushDeeper(),
					onSwipeMove: updateDrag,
				})
			}
			class="flex flex-col border-border bg-background"
			style={{ transform: paneTranslate("members") }}
			classList={{
				"min-w-72 w-72 h-full border-l": !isMobile(),
				hidden: !isMobile() && !preferences().membersListVisible,
				"absolute inset-0 w-full h-full z-30 will-change-pane": isMobile(),
				"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
					isMobile() && !isDragging(),
			}}
		>
			<Show when={isMobile()}>
				<div class="sticky top-0 left-0 border-b border-border bg-background h-12 min-h-12 p-2 w-full flex flex-row items-center gap-1">
					<button
						type="button"
						onClick={() => popPane()}
						class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/50 cursor-pointer"
						aria-label="Back"
					>
						<CaretLeftIcon width={20} height={20} />
					</button>
					<span class="font-medium">Members</span>
				</div>
			</Show>
			<div
				ref={attachScroller}
				class="p-4 overflow-y-auto overflow-x-clip flex-1"
			>
				<div class="relative w-full" style={{ height: `${layout().total}px` }}>
					<For each={visibleKeys()}>
						{(key) => {
							const row = () => rowByKey().get(key);
							const header = () => {
								const entry = row();
								return entry?.kind === "header" ? entry : undefined;
							};
							const member = () => {
								const entry = row();
								return entry?.kind === "member" ? entry : undefined;
							};
							const start = () => placementByKey().get(key) ?? 0;

							return (
								<div
									class="absolute top-0 left-0 w-full pb-3"
									classList={{ "pt-4": !!header()?.spaced }}
									style={{
										height: `${row()?.size ?? 0}px`,
										transform: `translateY(${start()}px)`,
									}}
								>
									<Show when={header()}>
										{(entry) => (
											<span class="text-sm text-muted-foreground block leading-5">
												{entry().label} — {entry().count}
											</span>
										)}
									</Show>
									<Show when={member()}>
										{(entry) => <MemberRow member={entry().member} />}
									</Show>
								</div>
							);
						}}
					</For>
				</div>
			</div>
		</div>
	);
};

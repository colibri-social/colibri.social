import {
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import CaretLeftIcon from "~icons/ph/caret-left";
import CrownIcon from "~icons/ph/crown-fill";
import UsersIconFill from "~icons/ph/users-fill";
import type { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import { useCommunityContext } from "../../../contexts/Community";
import { useMutes } from "../../../contexts/Mutes";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import createMediaQuery from "../../../utils/create-media-query";
import { createSwipe } from "../../../utils/create-swipe";
import { parseEmojiText } from "../../../utils/emoji";
import { getChannelParam } from "../../../utils/get-param";
import { groupMembersByRoles } from "../../../utils/group-members-by-roles";
import {
	createMobilePane,
	PANE_COMMIT_RATIO,
} from "../../../utils/mobile-pane";
import { Button } from "../../ui/Button";
import { isDrawerOpen } from "../../ui/MenuDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";
import User from "../user";
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

const MemberRow = (props: {
	member: Member;
	communityUri: string;
	roles: Role[];
}) => {
	const community = useCommunityContext();

	return (
		<MemberContextMenu member={props.member}>
			<User.ProfilePopover
				user={props.member}
				class="data-expanded:[&>div]:bg-muted!"
			>
				<div
					class="group/member flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1"
					onPointerDown={(e) => e.button !== 0 && e.stopPropagation()}
				>
					<User.Avatar user={props.member} />
					<div class="flex flex-col w-[calc(100%-36px-8px)] min-w-0">
						<span class="font-medium leading-5 flex flex-row items-center gap-2">
							<User.DisplayableName
								badge={false}
								user={props.member}
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
										innerHTML={parseEmojiText(props.member.data.status!.emoji!)}
									/>
								</Show>
								<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
									{props.member.data.status!.text}
								</span>
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

	const membersByRoles = () =>
		groupMembersByRoles({
			members: community().members,
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
				key: `header:${group.role.uri || group.role.name}`,
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

	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");
	const { preferences, toggleMembersVisible } = useUserPreferences();
	const {
		isMobile,
		popPane,
		pushDeeper,
		updateDrag,
		paneTranslate,
		isDragging,
	} = createMobilePane();
	const mutes = useMutes();

	const currentChannelUri = createMemo(() => {
		const rkey = getChannelParam();
		if (!rkey) return undefined;
		return community().channels.find((c) => c.uri.split("/").pop() === rkey)
			?.uri;
	});

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
			style={{ translate: paneTranslate("members") }}
			classList={{
				"min-w-72 w-72 h-full border-l z-50": !isMobile(),
				"absolute top-0 right-0 h-full drop-shadow-black drop-shadow-2xl":
					!isMobile() && displayMembersAsSheet(),
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
			<Show when={!isMobile() && displayMembersAsSheet()}>
				<div class="border-b border-border h-12 min-h-12 p-2 w-full flex flex-row items-center gap-1">
					<Show when={currentChannelUri()}>
						{(uri) => (
							<Tooltip>
								<TooltipTrigger>
									<Button
										size="icon-sm"
										variant="ghost"
										onClick={() =>
											mutes.isChannelMuted(uri())
												? mutes.unmuteChannel(uri())
												: mutes.muteChannel(uri())
										}
									>
										<Switch>
											<Match when={mutes.isChannelMuted(uri())}>
												<BellSlashIcon />
											</Match>
											<Match when={!mutes.isChannelMuted(uri())}>
												<BellIcon />
											</Match>
										</Switch>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<Switch>
										<Match when={mutes.isChannelMuted(uri())}>
											Unmute Channel
										</Match>
										<Match when={!mutes.isChannelMuted(uri())}>
											Mute Channel
										</Match>
									</Switch>
								</TooltipContent>
							</Tooltip>
						)}
					</Show>
					<Tooltip>
						<TooltipTrigger>
							<Button
								size="icon-sm"
								variant="ghost"
								onClick={() => toggleMembersVisible()}
							>
								<UsersIconFill />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Hide Member List</TooltipContent>
					</Tooltip>
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
										{(entry) => (
											<MemberRow
												member={entry().member}
												communityUri={community().community.uri}
												roles={community().assignableRoles}
											/>
										)}
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

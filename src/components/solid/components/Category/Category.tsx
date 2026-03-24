import { makePersisted } from "@solid-primitives/storage";
import { A, useParams } from "@solidjs/router";
import {
	createSortable,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import { ConnectionState } from "livekit-client";
import {
	type Component,
	createMemo,
	createSignal,
	For,
	Match,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import type {
	CommunityData,
	SidebarCategoryData,
	SidebarChannelData,
} from "@/utils/sdk";
import { useCommunityContext } from "../../contexts/CommunityContext";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { useVoiceChatContext } from "../../contexts/VoiceChatContext";
import Icon from "../../icons/Icon";
import type { MemberData } from "../../layouts/CommunityLayout";
import { Button } from "../../shadcn-solid/Button";
import { SmallUser } from "../SmallUser";
import { CategorySettingsModal } from "./CategorySettingsModal";
import { ChannelCreationModal } from "./ChannelCreationModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";

export type ChannelDropTarget = {
	catRkey: string;
	insertBeforeId: string | null;
};

const SortableChannel: Component<{
	channel: SidebarChannelData;
	community: CommunityData;
}> = (props) => {
	const params = useParams();
	const sortable = createSortable(props.channel.rkey);
	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;
	const [globalData] = useGlobalContext();
	const [voiceData, { connect }] = useVoiceChatContext();
	const communityData = useCommunityContext();

	const member = (did: string) =>
		communityData!.members().find((x) => x.member_did === did) ??
		({} as MemberData);

	const [isDragging, setIsDragging] = createSignal(false);

	onDndDragStart(({ draggable }) => {
		if (globalData.user.sub !== props.community.owner_did) return;
		if (String(draggable.id) === props.channel.rkey) setIsDragging(true);
	});

	onDndDragEnd(() => {
		if (globalData.user.sub !== props.community.owner_did) return;
		setTimeout(() => setIsDragging(false), 0);
	});

	const liveVoiceChannelMembers = createMemo<Array<string>>(() => {
		const updatedMemberState = globalData.knownVoiceChannelStates.find(
			(x) =>
				x.channel_rkey === props.channel.rkey &&
				x.community_uri.split("/").pop()! === props.community.rkey,
		);

		if (updatedMemberState)
			return updatedMemberState.member_dids.sort((a, b) => a.localeCompare(b));

		return props.channel.voice_members.sort((a, b) => a.localeCompare(b));
	});

	const handleVoiceChannelJoin = (
		e: MouseEvent & {
			currentTarget: HTMLAnchorElement;
			target: Element;
		},
	) => {
		const isDialog = () =>
			e.target.closest(".channel-settings") ||
			e.target.classList.contains("channel-settings") ||
			e.target.closest('[role="alertdialog"]') ||
			e.target.classList.contains('[data-slot="dialog-overlay"]');

		if (props.channel.channel_type !== "voice" || isDialog()) {
			return;
		}

		connect(
			props.community.owner_did,
			props.community.rkey,
			props.channel.rkey,
			props.channel.name,
		);
	};

	return (
		<div
			ref={
				globalData.user.sub === props.community.owner_did
					? sortable.ref
					: undefined
			}
			style={{
				"touch-action": "none",
				transform: sortable.transform
					? `translate(${sortable.transform.x}px, ${sortable.transform.y}px)`
					: undefined,
				transition: sortable.isActiveDraggable
					? "none"
					: "transform 150ms ease",
			}}
			classList={{
				"opacity-50":
					sortable.isActiveDraggable &&
					globalData.user.sub === props.community.owner_did,
			}}
			{...sortable.dragActivators}
		>
			<div
				class="flex flex-col gap-1"
				style={{ "pointer-events": isDragging() ? "none" : undefined }}
				draggable={false}
			>
				<A
					class="group/channel text-muted-foreground flex flex-row justify-between items-center gap-2 hover:bg-card rounded-sm cursor-pointer p-1 py-0.5 pr-1.25"
					onClick={handleVoiceChannelJoin}
					href={`/c/${params.community}/${props.channel.channel_type.slice(0, 1)}/${props.channel.rkey}`}
					activeClass="bg-card"
					classList={{
						"bg-linear-145 from-[#090615] via-[#31226d70] to-[#e0deec30] text-foreground!":
							voiceData.connection.rkey === props.channel.rkey &&
							voiceData.connection.state === ConnectionState.Connected,
					}}
				>
					<div class="flex flex-row items-center gap-2">
						<Switch>
							<Match when={props.channel.channel_type === "text"}>
								<Icon
									variant="regular"
									name="chat-circle-dots-icon"
									size={20}
								/>
							</Match>
							<Match when={props.channel.channel_type === "voice"}>
								<Switch>
									<Match
										when={
											voiceData.connection.rkey !== props.channel.rkey ||
											voiceData.connection.state !== ConnectionState.Connected
										}
									>
										<Icon
											variant="fill"
											name="speaker-low-icon"
											size={20}
											classList={{
												"text-white": liveVoiceChannelMembers().length > 0,
											}}
										/>
									</Match>
									<Match
										when={
											voiceData.connection.rkey === props.channel.rkey &&
											voiceData.connection.state === ConnectionState.Connected
										}
									>
										<Icon
											variant="fill"
											name="speaker-high-icon"
											size={20}
											classList={{
												"text-primary!": liveVoiceChannelMembers().length > 0,
											}}
										/>
									</Match>
								</Switch>
							</Match>
						</Switch>
						<span>{props.channel.name}</span>
					</div>
					<div class="flex justify-center items-center pb-px">
						<Show when={props.community.owner_did === globalData.user.sub}>
							<ChannelSettingsModal
								class="p-0 w-5 h-5.5"
								channel={props.channel}
							>
								<Button
									size="sm"
									class="opacity-0 group-hover/channel:opacity-100 p-0 w-5 h-5 cursor-pointer channel-settings"
									classList={{
										"opacity-100!": params.channel === props.channel.rkey,
									}}
									variant="ghost"
									onClick={(e) => e.preventDefault()}
								>
									<Icon variant="regular" name="gear-icon" size={16} />
								</Button>
							</ChannelSettingsModal>
						</Show>
					</div>
				</A>
				<Show
					when={
						props.channel.channel_type === "voice" &&
						liveVoiceChannelMembers().length > 0
					}
				>
					<div class="pl-8.5 text-muted-foreground flex flex-col select-none">
						<For each={liveVoiceChannelMembers()}>
							{(did) => (
								<SmallUser
									did={member(did).member_did}
									avatar={member(did).avatar_url}
									displayName={member(did).display_name}
									handle={member(did).handle}
								/>
							)}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};

/**
 * Builds the display order for channels: channels present in
 * `channel_order` come first (in that order), then any extras not listed.
 */
export function buildChannelOrder(category: SidebarCategoryData): string[] {
	const order = category.channel_order ?? [];
	const channelRkeys = new Set(category.channels.map((ch) => ch.rkey));
	const ordered = order.filter((id) => channelRkeys.has(id));
	const extras = category.channels
		.filter((ch) => !order.includes(ch.rkey))
		.map((ch) => ch.rkey);
	return [...ordered, ...extras];
}

/**
 * A single category on the sidebar.
 */
export const Category: ParentComponent<{
	category: SidebarCategoryData;
	community: CommunityData;
	activeDraggable: boolean;
	channelOrder: string[];
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	injectedChannels?: SidebarChannelData[];
	dropTarget?: ChannelDropTarget | null;
}> = (props) => {
	const [globalData] = useGlobalContext();
	const [open, setOpen] = makePersisted(createSignal(true), {
		name: props.category.rkey,
	});

	const orderedChannels = createMemo((): SidebarChannelData[] => {
		const order = props.channelOrder;
		const channelMap = new Map<string, SidebarChannelData>([
			...props.category.channels.map((ch): [string, SidebarChannelData] => [
				ch.rkey,
				ch,
			]),
			...(props.injectedChannels ?? []).map(
				(ch): [string, SidebarChannelData] => [ch.rkey, ch],
			),
		]);
		return order
			.map((id) => channelMap.get(id))
			.filter((ch): ch is SidebarChannelData => ch !== undefined);
	});

	const [, { onDragStart: onDndDragStart, onDragEnd: onDndDragEnd }] =
		useDragDropContext()!;

	let channelWasHere = false;
	onDndDragStart(({ draggable }) => {
		if (globalData.user.sub !== props.community.owner_did) return;
		channelWasHere = props.channelOrder.includes(String(draggable.id));
	});

	onDndDragEnd(({ draggable, droppable }) => {
		if (!channelWasHere) return;
		if (!draggable || !droppable) return;
		if (globalData.user.sub !== props.community.owner_did) return;

		const order = props.channelOrder;
		const from = order.indexOf(String(draggable.id));
		if (from === -1) return;

		const to = order.indexOf(String(droppable.id));
		if (to === -1 || from === to) return;

		const newOrder = order.slice();
		newOrder.splice(to, 0, ...newOrder.splice(from, 1));
		props.onChannelReorder(props.category.rkey, newOrder);
	});

	return (
		<div class="flex flex-col py-3">
			<button
				type="button"
				class="group/category flex flex-row justify-between items-center px-4 pb-2 pl-4.5 text-muted-foreground hover:text-foreground text-sm"
				style={{
					cursor:
						props.community.owner_did === globalData.user.sub
							? props.activeDraggable
								? "grabbing"
								: "grab"
							: "pointer",
				}}
			>
				<div
					class="flex flex-row items-center gap-2.5 cursor-pointer"
					onClick={() => setOpen((current) => !current)}
				>
					<Switch>
						<Match when={open()}>
							<Icon
								variant="regular"
								name="caret-right-icon"
								class="rotate-90"
							/>
						</Match>
						<Match when={!open()}>
							<Icon
								variant="regular"
								name="caret-right-icon"
								class="rotate-0"
							/>
						</Match>
					</Switch>
					<span>{props.category.name}</span>
				</div>
				<div class="flex flex-row items-center gap-1">
					<Show when={props.community.owner_did === globalData.user.sub}>
						<CategorySettingsModal category={props.category}>
							<Button
								size="sm"
								class="opacity-0 group-hover/category:opacity-100 w-5 h-5 cursor-pointer"
								variant="ghost"
							>
								<Icon variant="regular" name="gear-icon" size={16} />
							</Button>
						</CategorySettingsModal>
						<ChannelCreationModal
							category={props.category.rkey}
							community={props.community.rkey}
						>
							<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
								<Icon variant="regular" name="plus-icon" size={16} />
							</Button>
						</ChannelCreationModal>
					</Show>
				</div>
			</button>
			<div
				class="flex flex-col gap-1 mx-3"
				classList={{
					hidden: !open(),
				}}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<SortableProvider ids={props.channelOrder}>
					<For each={orderedChannels()}>
						{(channel) => (
							<>
								<Show when={props.dropTarget?.insertBeforeId === channel.rkey}>
									<div class="bg-primary mx-1 rounded h-0.5" />
								</Show>
								<SortableChannel
									channel={channel}
									community={props.community}
								/>
							</>
						)}
					</For>
					<Show
						when={props.dropTarget && props.dropTarget.insertBeforeId === null}
					>
						<div class="bg-primary mx-1 rounded h-0.5" />
					</Show>
				</SortableProvider>
				<Show when={orderedChannels().length === 0 && !props.dropTarget}>
					<span class="ml-8 text-muted-foreground text-xs">
						This category is empty.
					</span>
				</Show>
			</div>
		</div>
	);
};

import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { DocumentsIcon } from "@solar-icons/solid/bold/documents";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { VolumeLoudIcon } from "@solar-icons/solid/bold/volume-loud";
import { type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { ThreadIcon } from "../../icons/custom";
import { createSlot } from "../../utils/slot";
import type { ChannelMenuActions } from "../ContextMenu/ChannelMenu";
import { markReadIcon } from "../ContextMenu/menu-entries";
import {
	DeveloperModeCard,
	type DeveloperModeCardProps,
} from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { ListGroup, NavRow } from "../List/List";

export type ChannelDrawerProps = ChannelMenuActions & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	icon?: JSX.Element;
	developer?: DeveloperModeCardProps;
	onJoinVoice?: () => void;
	onOpenCall?: () => void;
	onOpenChat?: () => void;
};

export const ChannelDrawer = (props: ChannelDrawerProps) => {
	const icon = createSlot(() => props.icon ?? <ChatSquareDotsIcon />);
	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const hasGeneral = () =>
		!!(
			props.onMarkAsRead ||
			props.onMutedChange ||
			props.onStartThread ||
			props.onShowThreads ||
			props.onCopyLink
		);
	const hasManage = () => !!(props.onDuplicate || props.onEdit);
	const hasVoice = () =>
		!!(props.onJoinVoice || props.onOpenCall || props.onOpenChat);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<DrawerContent
				aria-label={`${props.name} options`}
				header={
					<span
						data-channel-drawer-header=""
						class="flex min-w-0 items-center gap-2"
					>
						<span
							aria-hidden="true"
							class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6"
						>
							{icon()}
						</span>
						<span class="min-w-0 truncate text-xl leading-7 font-bold">
							{props.name}
						</span>
					</span>
				}
			>
				<Show when={hasVoice()}>
					<ListGroup>
						<Show when={props.onOpenCall}>
							<NavRow
								chevron={false}
								icon={<VolumeLoudIcon />}
								label="Open call"
								onClick={run(props.onOpenCall)}
							/>
						</Show>
						<Show when={!props.onOpenCall && props.onJoinVoice}>
							<NavRow
								chevron={false}
								icon={<VolumeLoudIcon />}
								label="Join voice"
								onClick={run(props.onJoinVoice)}
							/>
						</Show>
						<Show when={props.onOpenChat}>
							<NavRow
								chevron={false}
								icon={<ChatSquareDotsIcon />}
								label="Open chat"
								onClick={run(props.onOpenChat)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={hasGeneral()}>
					<ListGroup>
						<Show when={props.onMarkAsRead}>
							<NavRow
								chevron={false}
								icon={<Dynamic component={markReadIcon("single")} />}
								label="Mark as read"
								onClick={run(props.onMarkAsRead)}
							/>
						</Show>
						<Show when={props.onMutedChange}>
							<NavRow
								chevron={false}
								icon={<BellOffIcon />}
								label={props.muted ? "Unmute channel" : "Mute channel"}
								onClick={run(() => props.onMutedChange?.(!props.muted))}
							/>
						</Show>
						<Show when={props.onStartThread}>
							<NavRow
								chevron={false}
								icon={<ThreadIcon />}
								label="Start a thread"
								onClick={run(props.onStartThread)}
							/>
						</Show>
						<Show when={props.onShowThreads}>
							<NavRow
								chevron={false}
								icon={<ChatRoundDotsIcon />}
								label="Show all threads"
								onClick={run(props.onShowThreads)}
							/>
						</Show>
						<Show when={props.onCopyLink}>
							<NavRow
								chevron={false}
								icon={<LinkIcon />}
								label="Copy channel link"
								onClick={run(props.onCopyLink)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={hasManage()}>
					<ListGroup>
						<Show when={props.onDuplicate}>
							<NavRow
								chevron={false}
								icon={<DocumentsIcon />}
								label="Duplicate"
								onClick={run(props.onDuplicate)}
							/>
						</Show>
						<Show when={props.onEdit}>
							<NavRow
								chevron={false}
								icon={<SettingsIcon />}
								label="Edit channel"
								onClick={run(props.onEdit)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={props.developerMode && props.developer}>
					{(developer) => <DeveloperModeCard {...developer()} />}
				</Show>
			</DrawerContent>
		</Drawer>
	);
};

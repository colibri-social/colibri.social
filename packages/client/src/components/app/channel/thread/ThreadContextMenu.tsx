import { createSignal, type ParentComponent, Show } from "solid-js";
import ArrowUUpRightIcon from "~icons/ph/arrow-u-up-right";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import EyeIcon from "~icons/ph/eye";
import EyeSlashIcon from "~icons/ph/eye-slash";
import PencilSimpleIcon from "~icons/ph/pencil-simple";
import TrashIcon from "~icons/ph/trash";
import { SPACE_TYPES } from "../../../../atproto/lexicons";
import type { ThreadView } from "../../../../atproto/views";
import { useCommunityContext } from "../../../../contexts/Community";
import { useMutes } from "../../../../contexts/Mutes";
import { useThreads } from "../../../../contexts/Threads";
import { createLongPress } from "../../../../utils/create-long-press";
import { useIsTouch } from "../../../../utils/touch";
import { Button } from "../../../ui/Button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../../ui/ContextMenu";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../../ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import {
	handoffDrawer,
	MenuDrawer,
	MenuDrawerItem,
} from "../../../ui/MenuDrawer";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../ui/Select";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../../ui/TextField";

type ThreadAction = {
	label: string;
	run: () => void;
};

export const ThreadContextMenu: ParentComponent<{
	thread: ThreadView;
	trigger?: "context" | "click";
}> = (props) => {
	const threads = useThreads();
	const mutes = useMutes();
	const community = useCommunityContext();
	const isTouch = useIsTouch();

	const [menuOpen, setMenuOpen] = createSignal(false);
	const [renameOpen, setRenameOpen] = createSignal(false);
	const [repointOpen, setRepointOpen] = createSignal(false);
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const [name, setName] = createSignal("");
	const [destination, setDestination] = createSignal<string | undefined>(
		undefined,
	);
	const [busy, setBusy] = createSignal(false);

	const muted = () => mutes.isChannelMuted(props.thread.space);
	const following = () => props.thread.viewer.following;
	const canManage = () => props.thread.viewer.canManage;

	const textChannels = () =>
		community().channels.filter(
			(channel) =>
				channel.type === SPACE_TYPES.channelText &&
				channel.viewer.canRead &&
				channel.space !== props.thread.channel,
		);

	const channelNameOf = (space: string): string =>
		community().channels.find((channel) => channel.space === space)?.name ??
		"another channel";

	const toggleFollow: ThreadAction = {
		label: following() ? "Leave Thread" : "Follow Thread",
		run: () =>
			void (following()
				? threads.unfollowThread(props.thread.space)
				: threads.followThread(props.thread.space)),
	};

	const toggleMute: ThreadAction = {
		label: muted() ? "Unmute Thread" : "Mute Thread",
		run: () =>
			void (muted()
				? mutes.unmuteChannel(props.thread.space)
				: mutes.muteChannel(props.thread.space)),
	};

	const openRename = () => {
		setName(props.thread.name);
		setRenameOpen(true);
	};

	const openRepoint = () => {
		setDestination(textChannels()[0]?.space);
		setRepointOpen(true);
	};

	const submitRename = async () => {
		const next = name().trim();
		if (!next || next === props.thread.name) {
			setRenameOpen(false);
			return;
		}
		setBusy(true);
		const ok = await threads.renameThread(props.thread.space, next);
		setBusy(false);
		if (ok) setRenameOpen(false);
	};

	const submitRepoint = async () => {
		const target = destination();
		if (!target) return;
		setBusy(true);
		const ok = await threads.repointThread(props.thread.space, target);
		setBusy(false);
		if (ok) setRepointOpen(false);
	};

	const submitDelete = async () => {
		setBusy(true);
		const ok = await threads.deleteThread(props.thread.space);
		setBusy(false);
		if (ok) setDeleteOpen(false);
	};

	return (
		<>
			<Show when={isTouch()}>
				<Show
					when={props.trigger === "click"}
					fallback={
						<div
							style={{ display: "contents" }}
							ref={(el) =>
								createLongPress(el, {
									enabled: () => isTouch(),
									onLongPress: () => setMenuOpen(true),
								})
							}
						>
							{props.children}
						</div>
					}
				>
					<div
						style={{ display: "contents" }}
						onClick={() => setMenuOpen(true)}
					>
						{props.children}
					</div>
				</Show>
				<MenuDrawer
					open={menuOpen()}
					onOpenChange={setMenuOpen}
					title={props.thread.name}
				>
					<MenuDrawerItem
						onClick={() =>
							handoffDrawer(() => setMenuOpen(false), toggleFollow.run)
						}
					>
						<Show when={following()} fallback={<EyeIcon />}>
							<EyeSlashIcon />
						</Show>
						<span>{toggleFollow.label}</span>
					</MenuDrawerItem>
					<MenuDrawerItem
						onClick={() =>
							handoffDrawer(() => setMenuOpen(false), toggleMute.run)
						}
					>
						<Show when={muted()} fallback={<BellSlashIcon />}>
							<BellIcon />
						</Show>
						<span>{toggleMute.label}</span>
					</MenuDrawerItem>
					<Show when={canManage()}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(() => setMenuOpen(false), openRename)
							}
						>
							<PencilSimpleIcon />
							<span>Rename Thread</span>
						</MenuDrawerItem>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(() => setMenuOpen(false), openRepoint)
							}
						>
							<ArrowUUpRightIcon />
							<span>Move to Channel</span>
						</MenuDrawerItem>
						<MenuDrawerItem
							destructive
							onClick={() =>
								handoffDrawer(
									() => setMenuOpen(false),
									() => setDeleteOpen(true),
								)
							}
						>
							<TrashIcon />
							<span>Delete Thread</span>
						</MenuDrawerItem>
					</Show>
				</MenuDrawer>
			</Show>
			<Show when={!isTouch() && props.trigger !== "click"}>
				<ContextMenu>
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent class="min-w-44">
							<ContextMenuItem onClick={toggleFollow.run}>
								<Show when={following()} fallback={<EyeIcon />}>
									<EyeSlashIcon />
								</Show>
								<span>{toggleFollow.label}</span>
							</ContextMenuItem>
							<ContextMenuItem onClick={toggleMute.run}>
								<Show when={muted()} fallback={<BellSlashIcon />}>
									<BellIcon />
								</Show>
								<span>{toggleMute.label}</span>
							</ContextMenuItem>
							<Show when={canManage()}>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={openRename}>
									<PencilSimpleIcon />
									<span>Rename Thread</span>
								</ContextMenuItem>
								<ContextMenuItem onClick={openRepoint}>
									<ArrowUUpRightIcon />
									<span>Move to Channel</span>
								</ContextMenuItem>
								<ContextMenuItem
									variant="destructive"
									onClick={() => setDeleteOpen(true)}
								>
									<TrashIcon />
									<span>Delete Thread</span>
								</ContextMenuItem>
							</Show>
						</ContextMenuContent>
					</ContextMenuPortal>
				</ContextMenu>
			</Show>
			<Show when={!isTouch() && props.trigger === "click"}>
				<DropdownMenu placement="bottom-end">
					<DropdownMenuTrigger as="div" class="flex items-center">
						{props.children}
					</DropdownMenuTrigger>
					<DropdownMenuPortal>
						<DropdownMenuContent class="min-w-44">
							<DropdownMenuItem onSelect={toggleFollow.run}>
								<Show when={following()} fallback={<EyeIcon />}>
									<EyeSlashIcon />
								</Show>
								<span>{toggleFollow.label}</span>
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={toggleMute.run}>
								<Show when={muted()} fallback={<BellSlashIcon />}>
									<BellIcon />
								</Show>
								<span>{toggleMute.label}</span>
							</DropdownMenuItem>
							<Show when={canManage()}>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={openRename}>
									<PencilSimpleIcon />
									<span>Rename Thread</span>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={openRepoint}>
									<ArrowUUpRightIcon />
									<span>Move to Channel</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => setDeleteOpen(true)}
								>
									<TrashIcon />
									<span>Delete Thread</span>
								</DropdownMenuItem>
							</Show>
						</DropdownMenuContent>
					</DropdownMenuPortal>
				</DropdownMenu>
			</Show>

			<Dialog open={renameOpen()} onOpenChange={setRenameOpen}>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Rename thread</DialogTitle>
						</DialogHeader>
						<TextField class="gap-1.5">
							<TextFieldLabel>Name</TextFieldLabel>
							<TextFieldInput
								value={name()}
								maxLength={128}
								onInput={(e) => setName(e.currentTarget.value)}
							/>
						</TextField>
						<DialogFooter class="flex-col gap-2 sm:flex-row">
							<Button
								class="ml-auto"
								variant="secondary"
								onClick={() => setRenameOpen(false)}
							>
								Cancel
							</Button>
							<Button disabled={busy()} onClick={() => void submitRename()}>
								Rename
							</Button>
						</DialogFooter>
					</DialogContent>
				</DialogPortal>
			</Dialog>

			<Dialog open={repointOpen()} onOpenChange={setRepointOpen}>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Move thread to another channel</DialogTitle>
						</DialogHeader>
						<p class="text-sm text-muted-foreground m-0">
							Who can read this thread follows the channel it belongs to, so
							moving it out of {channelNameOf(props.thread.channel)} changes who
							can read everything in it. The thread stops showing under the
							message it was opened from.
						</p>
						<Select
							value={destination()}
							onChange={(value) => setDestination(value ?? undefined)}
							options={textChannels().map((channel) => channel.space)}
							placeholder="Pick a channel"
							class="w-full [&_ul]:m-0 [&_li]:m-0"
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{channelNameOf(itemProps.item.rawValue)}
								</SelectItem>
							)}
						>
							<SelectTrigger class="w-full">
								<SelectValue<string>>
									{(state) => channelNameOf(state.selectedOption())}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
						<DialogFooter class="flex-col gap-2 sm:flex-row">
							<Button
								class="ml-auto"
								variant="secondary"
								onClick={() => setRepointOpen(false)}
							>
								Cancel
							</Button>
							<Button
								disabled={busy() || !destination()}
								onClick={() => void submitRepoint()}
							>
								Move Thread
							</Button>
						</DialogFooter>
					</DialogContent>
				</DialogPortal>
			</Dialog>

			<Dialog open={deleteOpen()} onOpenChange={setDeleteOpen}>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete {props.thread.name}?</DialogTitle>
						</DialogHeader>
						<p class="text-sm text-muted-foreground m-0">
							This permanently deletes the thread. Messages members wrote here
							stay in their own repos, but nobody except their authors will be
							able to read them afterward. Messages that were moved in go with
							it. This cannot be undone.
						</p>
						<DialogFooter class="flex-col gap-2 sm:flex-row">
							<Button
								class="ml-auto"
								variant="secondary"
								onClick={() => setDeleteOpen(false)}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								disabled={busy()}
								onClick={() => void submitDelete()}
							>
								Delete Thread
							</Button>
						</DialogFooter>
					</DialogContent>
				</DialogPortal>
			</Dialog>
		</>
	);
};

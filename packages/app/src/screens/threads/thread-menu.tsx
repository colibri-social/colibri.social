import {
	Button,
	ConfirmDialog,
	copyText,
	Modal,
	ModalClose,
	ModalContent,
	RadioRow,
	RadioRowGroup,
	TextField,
	THREAD_NAME_MAX_LENGTH,
	ThreadContextMenu,
	ThreadDrawer,
	type ThreadMoveTarget,
	toast,
} from "@colibri-social/ui";
import {
	createMemo,
	createSignal,
	For,
	type JSX,
	Show,
	untrack,
} from "solid-js";
import { channelSlug, skeyOf } from "../../data/ids";
import { useData } from "../../data/store";
import type { SpaceRef, ThreadView } from "../../data/types";
import { TEXT_CHANNEL } from "../../data/types";
import { openExternalUrl } from "../../native/open-external";
import { layerPath } from "../../shell/layers";
import { whenOverlaysClosed } from "../channel/forward/overlay-wait";

export type ThreadMenuOptions = {
	space: string;
	channel: string;
	channelType?: string;
	onDeleted?: (thread: ThreadView) => void;
};

export const createThreadMenu = (options: ThreadMenuOptions) => {
	const data = useData();
	const [target, setTarget] = createSignal<SpaceRef>();
	const [open, setOpen] = createSignal(false);
	const [confirming, setConfirming] = createSignal(false);
	const [snapshot, setSnapshot] = createSignal<ThreadView>();

	const thread = createMemo(() => {
		const ref = target();
		if (!ref) return undefined;
		return data.threads.find(ref) ?? snapshot();
	});
	const community = () => data.spaceByKey(options.space);
	const allowed = (permission: string) => {
		const viewer = community()?.viewer;
		return !!viewer?.isOwner || !!viewer?.permissions?.includes(permission);
	};
	const channelName = () => {
		const current = community();
		const view = thread();
		if (!current || !view) return undefined;
		return data
			.space(current)
			.channels.value()
			?.find((entry) => entry.space === view.channel)?.name;
	};
	const moveTargets = (): ThreadMoveTarget[] => {
		const view = thread();
		return view ? moveTargetsFor(view) : [];
	};
	const moveTargetsFor = (view: ThreadView): ThreadMoveTarget[] => {
		const current = community();
		if (!current) return [];
		return (data.space(current).channels.value() ?? [])
			.filter(
				(entry) =>
					entry.type === TEXT_CHANNEL &&
					entry.viewer?.canRead !== false &&
					entry.space !== view.channel,
			)
			.map((entry) => ({ id: entry.space, name: entry.name }));
	};
	const fail = (message: string) => (error: unknown) => {
		toast.error(message);
		throw error;
	};

	const copyLink = (view: ThreadView) => {
		const current = community();
		const parent = current
			? data
					.space(current)
					.channels.value()
					?.find((entry) => entry.space === view.channel)
			: undefined;
		const path = layerPath({
			kind: "thread",
			space: options.space,
			channel: parent ? channelSlug(parent) : options.channel,
			channelType: parent?.type ?? options.channelType,
			thread: skeyOf(view.space),
		});
		void copyText(`${location.origin}${path}`).then(() =>
			toast.success("Thread link copied"),
		);
	};

	const follow = (view: ThreadView, next: boolean) =>
		void data.threads
			.follow(view, next)
			.catch(() =>
				toast.error(
					next ? "Couldn't follow the thread" : "Couldn't leave the thread",
				),
			);
	const markRead = (view: ThreadView) =>
		void data.threads
			.markRead(view)
			.catch(() => toast.error("Couldn't mark as read"));
	const current = (view: ThreadView) => data.threads.find(view.space) ?? view;
	const setClosed = (view: ThreadView, closed: boolean, undoable = true) =>
		void data.threads
			.setClosed(current(view), closed)
			.then(() => {
				if (!undoable) return;
				toast.success(closed ? "Thread closed" : "Thread reopened", {
					action: {
						label: "Undo",
						onClick: () => setClosed(view, !closed, false),
					},
				});
			})
			.catch(() =>
				toast.error(
					closed ? "Couldn't close the thread" : "Couldn't reopen the thread",
				),
			);
	const setLocked = (view: ThreadView, locked: boolean, undoable = true) =>
		void data.threads
			.setLocked(current(view), locked)
			.then(() => {
				if (!undoable) return;
				toast.success(locked ? "Thread locked" : "Thread unlocked", {
					action: {
						label: "Undo",
						onClick: () => setLocked(view, !locked, false),
					},
				});
			})
			.catch(() =>
				toast.error(
					locked ? "Couldn't lock the thread" : "Couldn't unlock the thread",
				),
			);
	const rename = (view: ThreadView, name: string) =>
		data.threads.rename(view, name).catch(fail("Couldn't rename the thread"));
	const canMove = (view: ThreadView) =>
		view.viewer.canManage && allowed("thread.move");
	const moveTo = (view: ThreadView, channel: string) =>
		data.threads
			.repoint(view, channel as SpaceRef)
			.then(() => {
				toast.success(
					`Moved to #${moveTargets().find((entry) => entry.id === channel)?.name ?? "channel"}`,
				);
			})
			.catch(fail("Couldn't move the thread"));
	const requestDelete = (view: ThreadView) => {
		setSnapshot(view);
		void whenOverlaysClosed().then(() => setConfirming(true));
	};

	const [dialog, setDialog] = createSignal<"rename" | "move">();
	const [draft, setDraft] = createSignal("");
	const [destination, setDestination] = createSignal<string>();
	const [initialDestination, setInitialDestination] = createSignal<string>();
	const [busy, setBusy] = createSignal(false);
	const [failed, setFailed] = createSignal(false);

	const showDialog = (view: ThreadView, kind: "rename" | "move") => {
		setSnapshot(view);
		setTarget(view.space);
		setFailed(false);
		if (kind === "rename") setDraft(view.name);
		void whenOverlaysClosed().then(() => {
			if (kind === "move") {
				const first = untrack(moveTargets)[0]?.id;
				setDestination(first);
				setInitialDestination(first);
			}
			setDialog(kind);
		});
	};

	const submitDialog = async (run: () => Promise<unknown>) => {
		setBusy(true);
		setFailed(false);
		try {
			await run();
			setDialog(undefined);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};

	const DesktopDialogs = () => (
		<Show when={thread()}>
			{(view) => (
				<Modal
					open={!!dialog()}
					onOpenChange={(open) => {
						if (!open && !busy()) setDialog(undefined);
					}}
					dirty={
						!busy() &&
						((dialog() === "rename" && draft().trim() !== view().name) ||
							(dialog() === "move" && destination() !== initialDestination()))
					}
					discardDescription={
						dialog() === "move"
							? "The thread stays where it is."
							: "The thread keeps its current name."
					}
				>
					<Show when={dialog() === "rename"}>
						<ModalContent title="Rename thread">
							<form
								data-thread-rename=""
								class="flex flex-col gap-4"
								onSubmit={(event) => {
									event.preventDefault();
									const next = draft().trim();
									if (!next || next.length > THREAD_NAME_MAX_LENGTH) return;
									void submitDialog(() => rename(view(), next));
								}}
							>
								<TextField
									label="Name"
									value={draft()}
									onChange={setDraft}
									maxLength={THREAD_NAME_MAX_LENGTH}
									error={
										failed()
											? "Couldn't rename the thread. Try again."
											: undefined
									}
								/>
								<div class="flex justify-end gap-2">
									<ModalClose type="button" disabled={busy()}>
										Cancel
									</ModalClose>
									<Button
										type="submit"
										loading={busy()}
										disabled={
											!draft().trim() ||
											draft().trim().length > THREAD_NAME_MAX_LENGTH
										}
									>
										Rename
									</Button>
								</div>
							</form>
						</ModalContent>
					</Show>
					<Show when={dialog() === "move"}>
						<ModalContent
							title="Move to channel"
							description={`Who can read this thread follows the channel it belongs to, so moving it out of #${channelName() ?? "this channel"} changes who can read everything in it. The thread stops showing under the message it was opened from.`}
							footer={
								<>
									<Button
										variant="secondary"
										disabled={busy()}
										onClick={() => setDialog(undefined)}
									>
										Cancel
									</Button>
									<Button
										loading={busy()}
										disabled={!destination()}
										onClick={() => {
											const channel = destination();
											if (channel)
												void submitDialog(() => moveTo(view(), channel));
										}}
									>
										Move thread
									</Button>
								</>
							}
						>
							<div
								data-thread-move=""
								class="flex max-h-80 flex-col gap-2 overflow-y-auto"
							>
								<RadioRowGroup
									aria-label="Destination channel"
									value={destination()}
									onChange={setDestination}
								>
									<For each={moveTargets()}>
										{(entry) => (
											<RadioRow
												value={entry.id}
												title={
													<span class="block truncate">{`#${entry.name}`}</span>
												}
											/>
										)}
									</For>
								</RadioRowGroup>
								<Show when={failed()}>
									<p class="m-0 text-sm text-destructive" role="alert">
										Couldn't move the thread. Try again.
									</p>
								</Show>
							</div>
						</ModalContent>
					</Show>
				</Modal>
			)}
		</Show>
	);

	const ContextMenu = (props: {
		thread: ThreadView;
		children: JSX.Element;
	}) => {
		const view = () => data.threads.find(props.thread.space) ?? props.thread;
		return (
			<ThreadContextMenu
				name={view().name}
				following={!!view().viewer.following}
				onFollowingChange={(next) => follow(view(), next)}
				muted={data.isMuted(view().space)}
				onMutedChange={(muted) => data.setMuted(view().space, muted)}
				onMarkAsRead={
					view().viewer.hasUnread ? () => markRead(view()) : undefined
				}
				onCopyLink={() => copyLink(view())}
				developerMode={data.controls().developerMode}
				onCopyAtUri={() =>
					void copyText(view().space).then(() => toast.success("AT-URI copied"))
				}
				onShowOnPdsls={() =>
					openExternalUrl(`https://pdsls.dev/${view().space}`)
				}
				onRename={
					view().viewer.canEdit ? () => showDialog(view(), "rename") : undefined
				}
				onMove={
					canMove(view()) && moveTargetsFor(view()).length > 0
						? () => showDialog(view(), "move")
						: undefined
				}
				closed={!!view().closedAt}
				onClosedChange={
					view().viewer.canClose
						? (closed) => setClosed(view(), closed)
						: undefined
				}
				locked={!!view().locked}
				onLockedChange={
					view().viewer.canLock
						? (locked) => setLocked(view(), locked)
						: undefined
				}
				onDelete={
					view().viewer.canDelete
						? () => {
								setTarget(view().space);
								requestDelete(view());
							}
						: undefined
				}
			>
				{props.children}
			</ThreadContextMenu>
		);
	};

	const confirmDelete = async () => {
		const view = thread();
		if (!view) return;
		await data.threads.remove(view).catch(fail("Couldn't delete the thread"));
		toast.success(`Deleted ${view.name}`);
		options.onDeleted?.(view);
	};

	const Overlay = () => (
		<Show when={thread()}>
			{(view) => {
				return (
					<>
						<ThreadDrawer
							open={open()}
							onOpenChange={setOpen}
							name={view().name}
							channelName={channelName()}
							following={!!view().viewer.following}
							onFollowingChange={(follow) =>
								void data.threads
									.follow(view(), follow)
									.catch(() =>
										toast.error(
											follow
												? "Couldn't follow the thread"
												: "Couldn't leave the thread",
										),
									)
							}
							muted={data.isMuted(view().space)}
							onMutedChange={(muted) => data.setMuted(view().space, muted)}
							onMarkAsRead={
								view().viewer.hasUnread
									? () =>
											void data.threads
												.markRead(view())
												.catch(() => toast.error("Couldn't mark as read"))
									: undefined
							}
							onCopyLink={() => copyLink(view())}
							developerMode={data.controls().developerMode}
							developer={{
								copyLabel: "Copy AT-URI",
								copyValue: view().space,
								pdslsHref: `https://pdsls.dev/${view().space}`,
							}}
							onRename={
								view().viewer.canEdit
									? (name) =>
											data.threads
												.rename(view(), name)
												.catch(fail("Couldn't rename the thread"))
									: undefined
							}
							moveTargets={moveTargets()}
							onMove={
								canMove(view())
									? (channel) =>
											data.threads
												.repoint(view(), channel as SpaceRef)
												.then(() => {
													toast.success(
														`Moved to #${moveTargets().find((entry) => entry.id === channel)?.name ?? "channel"}`,
													);
												})
												.catch(fail("Couldn't move the thread"))
									: undefined
							}
							closed={!!view().closedAt}
							onClosedChange={
								view().viewer.canClose
									? (closed) => setClosed(view(), closed)
									: undefined
							}
							locked={!!view().locked}
							onLockedChange={
								view().viewer.canLock
									? (locked) => setLocked(view(), locked)
									: undefined
							}
							onDelete={
								view().viewer.canDelete
									? () => {
											setSnapshot(view());
											void whenOverlaysClosed().then(() => setConfirming(true));
										}
									: undefined
							}
						/>
						<DesktopDialogs />
						<ConfirmDialog
							open={confirming()}
							onOpenChange={setConfirming}
							title={`Delete ${view().name}?`}
							description="This permanently deletes the thread. Messages members wrote here stay in their own repos, but nobody except their authors will be able to read them afterward. Messages that were moved in go with it. This cannot be undone."
							confirmLabel="Delete thread"
							tone="destructive"
							onConfirm={confirmDelete}
						/>
					</>
				);
			}}
		</Show>
	);

	return {
		open: (view: ThreadView) => {
			setSnapshot(view);
			setTarget(view.space);
			void whenOverlaysClosed().then(() => setOpen(true));
		},
		Overlay,
		ContextMenu,
	};
};

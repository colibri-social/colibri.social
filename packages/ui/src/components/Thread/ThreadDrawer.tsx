import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	on,
	Show,
	Switch,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { ThreadIcon } from "../../icons/custom";
import { Button } from "../Button/Button";
import { markReadIcon } from "../ContextMenu/menu-entries";
import type { ThreadMenuActions } from "../ContextMenu/ThreadMenu";
import {
	DeveloperModeCard,
	type DeveloperModeCardProps,
} from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import {
	DestructiveRow,
	ListGroup,
	NavRow,
	RadioRow,
	RadioRowGroup,
	ToggleRow,
} from "../List/List";
import { TextField } from "../TextField/TextField";

export const THREAD_NAME_MAX_LENGTH = 128;

export type ThreadDrawerView = "actions" | "rename" | "move";

export type ThreadMoveTarget = { id: string; name: string };

export type ThreadDrawerProps = Omit<
	ThreadMenuActions,
	"onRename" | "onMove"
> & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	channelName?: string;
	onRename?: (name: string) => Promise<void> | void;
	moveTargets?: ThreadMoveTarget[];
	onMove?: (target: string) => Promise<void> | void;
	developer?: DeveloperModeCardProps;
};

const SubviewHeader = (props: {
	title: string;
	subtitle: string;
	onBack: () => void;
}) => (
	<div data-thread-drawer-header="" class="flex min-w-0 items-center gap-2">
		<IconButton
			variant="ghost"
			size="md"
			label="Back to thread options"
			icon={<ArrowLeftIcon />}
			onClick={props.onBack}
			class="-ml-1.5 [&_svg]:size-5"
		/>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="text-base leading-5 font-bold">{props.title}</span>
			<span class="min-w-0 truncate text-sm text-muted-foreground">
				{props.subtitle}
			</span>
		</span>
	</div>
);

export const ThreadDrawer = (props: ThreadDrawerProps) => {
	const [view, setView] = createSignal<ThreadDrawerView>("actions");
	const [draft, setDraft] = createSignal("");
	const [target, setTarget] = createSignal<string>();
	const [busy, setBusy] = createSignal(false);
	const [failed, setFailed] = createSignal(false);

	const open = createMemo(() => props.open);
	createEffect(
		on(open, (isOpen) => {
			if (!isOpen) return;
			setView("actions");
			setBusy(false);
			setFailed(false);
		}),
	);

	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const show = (next: ThreadDrawerView) => {
		setFailed(false);
		if (next === "rename") setDraft(props.name);
		if (next === "move") setTarget(props.moveTargets?.[0]?.id);
		setView(next);
	};
	const back = (event: KeyboardEvent) => {
		if (view() === "actions") return;
		event.preventDefault();
		event.stopPropagation();
		setView("actions");
	};
	const submit = async (action: () => Promise<void> | void) => {
		if (busy()) return;
		setBusy(true);
		setFailed(false);
		try {
			await action();
			props.onOpenChange(false);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const trimmed = () => draft().trim();
	const canRename = () =>
		trimmed().length > 0 && trimmed().length <= THREAD_NAME_MAX_LENGTH;
	const rename = () => {
		const next = trimmed();
		if (!canRename()) return;
		if (next === props.name) {
			props.onOpenChange(false);
			return;
		}
		void submit(() => props.onRename?.(next));
	};
	const move = () => {
		const next = target();
		if (!next) return;
		void submit(() => props.onMove?.(next));
	};

	const dirty = () =>
		props.open &&
		!busy() &&
		((view() === "rename" && trimmed() !== props.name) ||
			(view() === "move" && target() !== props.moveTargets?.[0]?.id));
	const discardDescription = () =>
		view() === "move"
			? "The thread stays where it is."
			: "The thread keeps its current name.";

	const hasNotifications = () =>
		!!(props.onFollowingChange || props.onMarkAsRead || props.onMutedChange);
	const hasManage = () =>
		!!(
			props.onCopyLink ||
			props.onRename ||
			(props.onMove && (props.moveTargets?.length ?? 0) > 0)
		);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
			dirty={dirty()}
			discardDescription={discardDescription()}
		>
			<DrawerContent
				aria-label={`${props.name} options`}
				onEscapeKeyDown={back}
				header={
					<Switch
						fallback={
							<div
								data-thread-drawer-header=""
								class="flex min-w-0 items-center gap-2"
							>
								<span
									aria-hidden="true"
									class="flex size-5 shrink-0 items-center justify-center"
								>
									<ThreadIcon size={20} />
								</span>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="min-w-0 truncate text-lg leading-6 font-bold">
										{props.name}
									</span>
									<Show when={props.channelName}>
										{(channel) => (
											<span class="min-w-0 truncate text-sm text-muted-foreground">
												{`in #${channel()}`}
											</span>
										)}
									</Show>
								</span>
							</div>
						}
					>
						<Match when={view() === "rename"}>
							<SubviewHeader
								title="Rename thread"
								subtitle={props.name}
								onBack={() => setView("actions")}
							/>
						</Match>
						<Match when={view() === "move"}>
							<SubviewHeader
								title="Move to channel"
								subtitle={props.name}
								onBack={() => setView("actions")}
							/>
						</Match>
					</Switch>
				}
			>
				<Switch>
					<Match when={view() === "rename"}>
						<form
							data-thread-rename=""
							class="flex flex-col gap-4"
							onSubmit={(event) => {
								event.preventDefault();
								rename();
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
							<Button
								type="submit"
								block
								loading={busy()}
								disabled={!canRename()}
							>
								Rename
							</Button>
						</form>
					</Match>
					<Match when={view() === "move"}>
						<div data-thread-move="" class="flex flex-col gap-4">
							<p class="m-0 text-sm text-muted-foreground">
								{`Who can read this thread follows the channel it belongs to, so moving it out of #${props.channelName ?? "this channel"} changes who can read everything in it. The thread stops showing under the message it was opened from.`}
							</p>
							<RadioRowGroup
								aria-label="Destination channel"
								value={target()}
								onChange={setTarget}
							>
								<For each={props.moveTargets ?? []}>
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
							<Button
								block
								loading={busy()}
								disabled={!target()}
								onClick={move}
							>
								Move thread
							</Button>
						</div>
					</Match>
					<Match when={view() === "actions"}>
						<Show when={hasNotifications()}>
							<ListGroup>
								<Show when={props.onFollowingChange}>
									<ToggleRow
										icon={<EyeIcon />}
										title="Follow thread"
										checked={!!props.following}
										onChange={(checked) => props.onFollowingChange?.(checked)}
									/>
								</Show>
								<Show when={props.onMarkAsRead}>
									<NavRow
										icon={<Dynamic component={markReadIcon("single")} />}
										label="Mark as read"
										onClick={run(props.onMarkAsRead)}
									/>
								</Show>
								<Show when={props.onMutedChange}>
									<ToggleRow
										icon={<BellOffIcon />}
										title="Mute thread"
										checked={!!props.muted}
										onChange={(checked) => props.onMutedChange?.(checked)}
									/>
								</Show>
							</ListGroup>
						</Show>
						<Show when={hasManage()}>
							<ListGroup>
								<Show when={props.onCopyLink}>
									<NavRow
										icon={<LinkIcon />}
										label="Copy thread link"
										onClick={run(props.onCopyLink)}
									/>
								</Show>
								<Show when={props.onRename}>
									<NavRow
										icon={<PenIcon />}
										label="Rename thread"
										onClick={() => show("rename")}
									/>
								</Show>
								<Show
									when={props.onMove && (props.moveTargets?.length ?? 0) > 0}
								>
									<NavRow
										icon={<ForwardIcon />}
										label="Move to channel"
										onClick={() => show("move")}
									/>
								</Show>
							</ListGroup>
						</Show>
						<Show when={props.onDelete}>
							<ListGroup>
								<DestructiveRow
									icon={<TrashBinTrashIcon />}
									label="Delete thread"
									onClick={run(props.onDelete)}
								/>
							</ListGroup>
						</Show>
						<Show when={props.developerMode && props.developer}>
							{(developer) => <DeveloperModeCard {...developer()} />}
						</Show>
					</Match>
				</Switch>
			</DrawerContent>
		</Drawer>
	);
};

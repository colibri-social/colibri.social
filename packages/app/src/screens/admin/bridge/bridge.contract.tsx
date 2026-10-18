import {
	Button,
	ConfirmDialog,
	DestructiveRow,
	ListGroup,
	Select,
	type SelectOption,
	Skeleton,
	StatusScreen,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import {
	createMemo,
	createResource,
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
import type {
	BridgeBackfillStatus,
	BridgeLink,
	SpaceRef,
} from "../../../data/types";
import { TEXT_CHANNEL } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { createUnsavedForm, UnsavedBar } from "../../settings/unsaved-form";
import {
	HISTORY_DEPTHS,
	type HistoryDepth,
	historyPercent,
	historyRequest,
	platformName,
} from "../bridges/bridge-catalog";
import { DISCONNECT_COPY } from "../bridges/pairing";
import { AdminNavHeader } from "../desktop/page-header";
import { SPACE_PERMISSIONS, useAdminSpace } from "../space-admin";

const UNLINKED = "";

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

const sortLinks = (links: readonly BridgeLink[]) =>
	[...links]
		.map(({ backfill: _backfill, ...rest }) => rest)
		.sort((a, b) => a.channel.localeCompare(b.channel));

export const historyLabel = (status: BridgeBackfillStatus) => {
	const count = numberFormat.format(status.imported);
	if (status.state === "done") return `Imported ${count} earlier messages.`;
	if (status.state === "failed")
		return `The history import stopped after ${count} messages. Choose a range again to retry.`;
	const reached = status.reached
		? `, up to ${dateFormat.format(new Date(status.reached))}`
		: "";
	return `Importing history: ${historyPercent(status)}%, ${count} messages${reached}`;
};

export const bridge = defineContract({
	id: "adminBridge",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const data = createMemo(() => {
			const community = admin.community();
			return community
				? admin.data.directory.bridges(community.did)
				: undefined;
		});
		const registration = createMemo(() =>
			args.id ? data()?.find(args.id) : undefined,
		);
		const [rooms] = createResource(
			() => (registration() ? args.id : undefined),
			(id) => data()?.rooms(id) ?? Promise.resolve([]),
		);
		const channels = createMemo(() => {
			const community = admin.community();
			if (!community) return [];
			return (
				admin.data
					.space(community)
					.channels.value()
					?.filter((channel) => channel.type === TEXT_CHANNEL) ?? []
			);
		});
		const [draftLinks, setDraftLinks] = createSignal<BridgeLink[]>();
		const [depths, setDepths] = createSignal<Record<string, HistoryDepth>>({});
		const [busy, setBusy] = createSignal(false);
		const [confirmOpen, setConfirmOpen] = createSignal(false);

		const links = () => draftLinks() ?? registration()?.links ?? [];
		const roomOptions = createMemo((): SelectOption[] => [
			{ value: UNLINKED, label: "Not linked" },
			...(rooms() ?? []).map((room) => ({
				value: room.id,
				label: room.parent ? `${room.name} (${room.parent})` : room.name,
			})),
		]);
		const linkedRoom = (channel: SpaceRef) =>
			links().find((link) => link.channel === channel)?.remoteRoom ?? UNLINKED;
		const setRoom = (channel: SpaceRef, roomId: string) => {
			const others = links().filter((link) => link.channel !== channel);
			const room = (rooms() ?? []).find((entry) => entry.id === roomId);
			setDraftLinks(
				room
					? [...others, { channel, remoteRoom: room.id, remoteName: room.name }]
					: others,
			);
		};
		const depthOf = (channel: SpaceRef) => depths()[channel] ?? "none";
		const setDepth = (channel: SpaceRef, depth: HistoryDepth) =>
			setDepths((current) => ({ ...current, [channel]: depth }));
		const historyOf = (channel: SpaceRef) => {
			const request = registration()?.links.find(
				(link) => link.channel === channel,
			)?.backfill;
			if (!request) return undefined;
			return registration()?.backfills?.find(
				(status) =>
					status.channel === channel &&
					status.requestedAt === request.requestedAt,
			);
		};
		const importsChosen = () =>
			links().some((link) => depthOf(link.channel as SpaceRef) !== "none");
		const edited = () =>
			importsChosen() ||
			JSON.stringify(sortLinks(links())) !==
				JSON.stringify(sortLinks(registration()?.links ?? []));

		const run = async (
			changes: Parameters<NonNullable<ReturnType<typeof data>>["update"]>[1],
		) => {
			const id = args.id;
			const current = data();
			if (!id || !current || busy()) return false;
			setBusy(true);
			try {
				await current.update(id, changes);
				return true;
			} catch {
				toast.error("Failed to update the bridge.");
				return false;
			} finally {
				setBusy(false);
			}
		};

		const saveLinks = async () => {
			const now = new Date();
			const requested = links().map((link) => {
				const backfill = historyRequest(depthOf(link.channel as SpaceRef), now);
				return backfill ? { ...link, backfill } : link;
			});
			if (await run({ links: requested })) {
				setDraftLinks(undefined);
				setDepths({});
				toast.success("Links saved");
			}
		};

		const reset = () => {
			setDraftLinks(undefined);
			setDepths({});
		};

		let disconnected = false;
		const unsaved = createUnsavedForm({
			depth: () =>
				stack
					.mounted()
					.findIndex(
						(layer) =>
							layer.kind === "admin" &&
							layer.page === "bridge" &&
							layer.space === args.space &&
							layer.id === args.id,
					) + 1,
			dirty: () => !disconnected && edited(),
			saving: busy,
			save: saveLinks,
			reset,
		});

		const disconnect = async () => {
			const id = args.id;
			if (!id) return;
			try {
				await data()?.disconnect(id);
				disconnected = true;
				setConfirmOpen(false);
				toast.success("Bridge disconnected");
				stack.pop();
			} catch {
				toast.error("Failed to disconnect the bridge.");
			}
		};

		return {
			stack,
			admin,
			allowed: () => !admin.community() || admin.can(SPACE_PERMISSIONS.manage),
			loading: () => !data() || (data()?.loading() ?? true),
			missing: () =>
				admin.missing() ||
				(!!data() && !(data()?.loading() ?? true) && !registration()),
			registration,
			rooms,
			channels,
			roomOptions,
			linkedRoom,
			setRoom,
			depthOf,
			setDepth,
			historyOf,
			edited,
			busy,
			run,
			saveLinks,
			reset,
			unsaved,
			confirmOpen,
			setConfirmOpen,
			disconnect,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to Bridges"
				onNavigate={() => m.stack.pop()}
				title={m.registration()?.remoteSpaceName ?? "Bridge"}
			/>
		)),
		Unavailable: slot((m) => (
			<StatusScreen
				tone={m.admin.missing() ? "destructive" : "neutral"}
				icon={
					m.admin.missing() ? (
						<DangerTriangleIcon />
					) : (
						<TransferHorizontalIcon />
					)
				}
				title={
					m.admin.missing()
						? "This Space isn't available"
						: !m.allowed()
							? "You can't manage bridges here"
							: "This bridge isn't connected anymore"
				}
				description={
					m.admin.missing()
						? "It may have been deleted, or you're no longer a member."
						: !m.allowed()
							? "Ask someone with the Manage Space permission to change bridges."
							: "It may have been disconnected by someone else."
				}
				actions={
					<Button block variant="secondary" onClick={() => m.stack.pop()}>
						Back to Bridges
					</Button>
				}
			/>
		)),
		Summary: slot((m) => (
			<Show when={m.registration()}>
				{(registration) => (
					<div class="flex items-center gap-3">
						<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-5">
							<TransferHorizontalIcon aria-hidden="true" />
						</span>
						<div class="flex min-w-0 flex-col">
							<span class="truncate font-semibold">
								{registration().remoteSpaceName}
							</span>
							<span class="truncate text-xs text-muted-foreground">
								{`${platformName(registration().platform)} bridge run by ${registration().bridgeHandle ?? registration().bridge}`}
							</span>
						</div>
					</div>
				)}
			</Show>
		)),
		Toggles: slot((m) => (
			<Show when={m.registration()}>
				{(registration) => (
					<ListGroup>
						<ToggleRow
							title="Relay messages"
							description="Pausing keeps the linked channels, so you can resume later."
							checked={registration().enabled}
							disabled={m.busy()}
							onChange={(enabled) => void m.run({ enabled })}
						/>
						<ToggleRow
							title="Mirror moderation"
							description={`Hiding a relayed message here also removes it on ${platformName(registration().platform)}, and messages its moderators remove are hidden here. The bridge needs permission to manage messages there.`}
							checked={registration().mirrorModeration ?? false}
							disabled={m.busy()}
							onChange={(mirrorModeration) => void m.run({ mirrorModeration })}
						/>
					</ListGroup>
				)}
			</Show>
		)),
		Links: slot((m) => (
			<section aria-labelledby="bridge-links" class="flex flex-col gap-3">
				<h2 id="bridge-links" class="m-0 text-sm font-semibold">
					Linked channels
				</h2>
				<Switch>
					<Match when={m.rooms.error}>
						<p class="m-0 text-sm text-destructive">
							Couldn't load the bridge's rooms.
						</p>
					</Match>
					<Match when={m.rooms.loading}>
						<div class="flex flex-col gap-2" aria-busy="true">
							<Skeleton class="h-10 w-full rounded-control" />
							<Skeleton class="h-10 w-full rounded-control" />
						</div>
					</Match>
					<Match when={(m.rooms() ?? []).length === 0}>
						<p class="m-0 text-sm text-muted-foreground">
							{`The bridge has not reported any rooms yet. Make sure it is running and can see the channels on ${platformName(m.registration()?.platform ?? "")}.`}
						</p>
					</Match>
					<Match when={m.rooms()}>
						<div class="flex flex-col gap-4">
							<For each={m.channels()}>
								{(channel) => (
									<div data-bridge-link="" class="flex min-w-0 flex-col gap-2">
										<Select
											platform={usePlatform()()}
											label={`#${channel.name}`}
											aria-label={`Room linked to ${channel.name}`}
											options={m.roomOptions()}
											value={m.linkedRoom(channel.space)}
											onChange={(value) => m.setRoom(channel.space, value)}
											disabled={m.busy()}
										/>
										<Show when={m.linkedRoom(channel.space) !== UNLINKED}>
											<Select
												platform={usePlatform()()}
												aria-label={`Import earlier messages into ${channel.name}`}
												options={HISTORY_DEPTHS.map((depth) => ({
													value: depth.value,
													label: depth.label,
												}))}
												value={m.depthOf(channel.space)}
												onChange={(value) =>
													m.setDepth(channel.space, value as HistoryDepth)
												}
												disabled={m.busy()}
											/>
										</Show>
										<Show when={m.historyOf(channel.space)}>
											{(status) => (
												<div class="flex flex-col gap-1">
													<Show when={status().state === "running"}>
														<div
															role="progressbar"
															aria-label="History import"
															aria-valuemin={0}
															aria-valuemax={100}
															aria-valuenow={historyPercent(status())}
															class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
														>
															<div
																class="h-full rounded-full bg-primary"
																style={{
																	width: `${historyPercent(status())}%`,
																}}
															/>
														</div>
													</Show>
													<span
														class="text-xs"
														classList={{
															"text-destructive": status().state === "failed",
															"text-muted-foreground":
																status().state !== "failed",
														}}
													>
														{historyLabel(status())}
													</span>
												</div>
											)}
										</Show>
									</div>
								)}
							</For>
						</div>
					</Match>
				</Switch>
			</section>
		)),
		Bar: slot((m) => <UnsavedBar form={m.unsaved} />),
		Danger: slot((m) => (
			<>
				<ListGroup>
					<DestructiveRow
						label="Disconnect bridge"
						onClick={() => m.setConfirmOpen(true)}
					/>
				</ListGroup>
				<ConfirmDialog
					open={m.confirmOpen()}
					onOpenChange={m.setConfirmOpen}
					title={DISCONNECT_COPY.title}
					description={DISCONNECT_COPY.description}
					confirmLabel="Disconnect"
					tone="destructive"
					onConfirm={m.disconnect}
				/>
			</>
		)),
	},
});

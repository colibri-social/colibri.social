import {
	type Component,
	createEffect,
	createMemo,
	createResource,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import PlugsConnectedIcon from "~icons/ph/plugs-connected";
import TrashIcon from "~icons/ph/trash";
import { colibri } from "../../../atproto/lexicons";
import type {
	BridgeBackfillStatus,
	BridgeLink,
	BridgePairingView,
	BridgeRegistrationView,
	BridgeRemoteRoom,
} from "../../../atproto/views";
import { clientForManagingApp } from "../../../atproto/xrpc";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import {
	HISTORY_DEPTHS,
	type HistoryDepth,
	historyPercent,
	historyRequest,
	platformName,
} from "../../../utils/bridge";
import { ErrorState } from "../../ErrorState";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../ui/Dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../ui/Select";
import {
	Switch as SwitchComp,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { SettingsPage } from "../common/SettingsModal";

const TEXT_CHANNEL = "social.colibri.beta.channel.text";

type RoomOption = { id: string; label: string };

const UNLINKED: RoomOption = { id: "", label: "Not linked" };

type DepthOption = { id: HistoryDepth; label: string };

const NO_IMPORT = HISTORY_DEPTHS[0] as DepthOption;

const PROGRESS_POLL_MS = 5000;

const numberFormat = new Intl.NumberFormat();

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const HistoryStatus: Component<{ status: BridgeBackfillStatus }> = (props) => {
	const count = () => numberFormat.format(props.status.imported);
	return (
		<Switch>
			<Match when={props.status.state === "running"}>
				<div class="flex flex-col gap-1">
					<div
						class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-label="History import"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={historyPercent(props.status)}
					>
						<div
							class="h-full rounded-full bg-primary transition-[width]"
							style={{ width: `${historyPercent(props.status)}%` }}
						/>
					</div>
					<span class="text-xs text-muted-foreground">
						Importing history: {historyPercent(props.status)}%, {count()}{" "}
						messages
						<Show when={props.status.reached}>
							{(reached) => (
								<>, up to {dateFormat.format(new Date(reached()))}</>
							)}
						</Show>
					</span>
				</div>
			</Match>
			<Match when={props.status.state === "done"}>
				<span class="text-xs text-muted-foreground">
					Imported {count()} earlier messages.
				</span>
			</Match>
			<Match when={props.status.state === "failed"}>
				<span class="text-xs text-destructive">
					The history import stopped after {count()} messages. Choose a range
					again to retry.
				</span>
			</Match>
		</Switch>
	);
};

const useManagingClient = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	return () =>
		clientForManagingApp(user.atproto.agent, community().community.managingApp);
};

const PairingForm: Component<{ onConnected: () => void }> = (props) => {
	const community = useCommunityContext();
	const client = useManagingClient();
	const [code, setCode] = createSignal("");
	const [pairing, setPairing] = createSignal<BridgePairingView | null>(null);
	const [busy, setBusy] = createSignal(false);

	const lookUp = async () => {
		setBusy(true);
		try {
			const res = await client().call(colibri.bridge.getPairing.main, {
				params: { code: code().trim() },
			});
			if (!res.ok) {
				showError(res.error, {
					fallbackTitle: "That pairing code did not work.",
				});
				return;
			}
			setPairing(res.data.pairing);
		} finally {
			setBusy(false);
		}
	};

	const connect = async () => {
		setBusy(true);
		try {
			const res = await client().call(colibri.bridge.redeemPairing.main, {
				body: { community: community().community.did, code: code().trim() },
			});
			if (!res.ok) {
				showError(res.error, {
					fallbackTitle: "Failed to connect the bridge.",
				});
				return;
			}
			setCode("");
			setPairing(null);
			props.onConnected();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div class="flex flex-col gap-3 rounded-lg border border-border p-4">
			<Show
				when={pairing()}
				fallback={
					<form
						class="flex flex-col gap-2 sm:flex-row sm:items-end"
						onSubmit={(event) => {
							event.preventDefault();
							void lookUp();
						}}
					>
						<TextField
							class="flex-1"
							value={code()}
							onChange={(value) => setCode(value)}
						>
							<TextFieldLabel>Pairing code</TextFieldLabel>
							<TextFieldInput
								placeholder="ABCD2345"
								autocomplete="off"
								spellcheck={false}
							/>
						</TextField>
						<Button
							type="submit"
							variant="secondary"
							disabled={busy() || code().trim().length === 0}
						>
							Look up
						</Button>
					</form>
				}
			>
				{(found) => (
					<>
						<p class="m-0 text-sm">
							<strong>{found().bridgeHandle ?? found().bridge}</strong> wants to
							connect <strong>{found().remoteSpaceName}</strong> on{" "}
							{platformName(found().platform)} to this community.
						</p>
						<p class="m-0 text-sm text-muted-foreground">
							Once connected, it can post messages and reactions from people on{" "}
							{platformName(found().platform)} into the channels you link, and
							read those channels to relay them back. Every member can see which
							bridges are connected.
						</p>
						<div class="flex gap-2 justify-end">
							<Button variant="secondary" onClick={() => setPairing(null)}>
								Cancel
							</Button>
							<Button disabled={busy()} onClick={() => void connect()}>
								<Show when={busy()}>
									<Spinner />
								</Show>
								Connect
							</Button>
						</div>
					</>
				)}
			</Show>
		</div>
	);
};

const RevokeBridgeDialog: Component<{
	registration: BridgeRegistrationView;
	onRevoked: () => void;
}> = (props) => {
	const client = useManagingClient();
	const [open, setOpen] = createSignal(false);
	const [busy, setBusy] = createSignal(false);

	const revoke = async () => {
		setBusy(true);
		try {
			const res = await client().call(colibri.bridge.revoke.main, {
				body: {
					community: props.registration.community,
					registration: props.registration.id,
				},
			});
			if (!res.ok) {
				showError(res.error, {
					fallbackTitle: "Failed to disconnect the bridge.",
				});
				return;
			}
			setOpen(false);
			props.onRevoked();
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>
				<Button
					size="sm"
					variant="ghost"
					class="text-destructive hover:text-destructive hover:bg-destructive/25"
				>
					<TrashIcon />
					Disconnect
				</Button>
			</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-128">
					<DialogHeader>
						<DialogTitle>Disconnect this bridge?</DialogTitle>
					</DialogHeader>
					<p class="m-0 text-sm text-muted-foreground">
						The bridge stops relaying straight away. Messages it already relayed
						stay where they are. To reconnect, pair it again with a new code.
					</p>
					<DialogFooter class="flex-col sm:flex-row gap-2">
						<Button
							class="ml-auto"
							variant="secondary"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={busy()}
							onClick={() => void revoke()}
						>
							Disconnect
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

const RegistrationCard: Component<{
	registration: BridgeRegistrationView;
	onChanged: () => void;
}> = (props) => {
	const community = useCommunityContext();
	const client = useManagingClient();
	const [busy, setBusy] = createSignal(false);
	const [links, setLinks] = createSignal<readonly BridgeLink[]>(
		props.registration.links,
	);
	const [depths, setDepths] = createSignal<Record<string, HistoryDepth>>({});
	const [backfills, setBackfills] = createSignal<
		readonly BridgeBackfillStatus[]
	>(props.registration.backfills ?? []);

	const historyOf = (channel: string) => {
		const request = props.registration.links.find(
			(link) => link.channel === channel,
		)?.backfill;
		if (!request) return undefined;
		return backfills().find(
			(status) =>
				status.channel === channel &&
				status.requestedAt === request.requestedAt,
		);
	};

	const importing = () =>
		props.registration.enabled &&
		props.registration.links.some((link) => {
			if (!link.backfill) return false;
			const status = historyOf(link.channel);
			return !status || status.state === "running";
		});

	createEffect(() => {
		if (!importing()) return;
		const timer = setInterval(async () => {
			const res = await client().call(colibri.bridge.listRegistrations.main, {
				params: { community: props.registration.community },
			});
			if (!res.ok) return;
			const latest = res.data.registrations.find(
				(entry) => entry.id === props.registration.id,
			);
			if (latest) setBackfills(latest.backfills ?? []);
		}, PROGRESS_POLL_MS);
		onCleanup(() => clearInterval(timer));
	});

	const [rooms] = createResource(
		() => props.registration.id,
		async (registration) => {
			const res = await client().call(colibri.bridge.listRemoteRooms.main, {
				params: { community: props.registration.community, registration },
			});
			if (!res.ok) throw res.error;
			return res.data.rooms;
		},
	);

	const textChannels = createMemo(() =>
		community().channels.filter((channel) => channel.type === TEXT_CHANNEL),
	);

	const roomOptions = createMemo((): RoomOption[] => [
		UNLINKED,
		...(rooms() ?? []).map((room: BridgeRemoteRoom) => ({
			id: room.id,
			label: room.parent ? `${room.name} (${room.parent})` : room.name,
		})),
	]);

	const linkedRoom = (channel: string): RoomOption => {
		const link = links().find((entry) => entry.channel === channel);
		if (!link) return UNLINKED;
		return (
			roomOptions().find((option) => option.id === link.remoteRoom) ?? {
				id: link.remoteRoom,
				label: link.remoteName,
			}
		);
	};

	const setRoom = (channel: string, option: RoomOption | null) => {
		const others = links().filter((entry) => entry.channel !== channel);
		const room = option?.id
			? (rooms() ?? []).find((entry) => entry.id === option.id)
			: undefined;
		setLinks(
			room
				? [
						...others,
						{
							channel,
							remoteRoom: room.id,
							remoteName: room.name,
						} as BridgeLink,
					]
				: others,
		);
	};

	const depthOf = (channel: string): DepthOption =>
		HISTORY_DEPTHS.find((option) => option.id === depths()[channel]) ??
		NO_IMPORT;

	const setDepth = (channel: string, option: DepthOption | null) =>
		setDepths({ ...depths(), [channel]: option?.id ?? "none" });

	const requested = (): readonly BridgeLink[] => {
		const now = new Date();
		return links().map((link) => {
			const depth = depths()[link.channel];
			return depth && depth !== "none"
				? {
						...link,
						backfill: historyRequest(depth, now) as BridgeLink["backfill"],
					}
				: link;
		});
	};

	const importsChosen = () =>
		links().some((link) => (depths()[link.channel] ?? "none") !== "none");

	const edited = () =>
		importsChosen() ||
		JSON.stringify(
			[...links()].sort((a, b) => a.channel.localeCompare(b.channel)),
		) !==
			JSON.stringify(
				[...props.registration.links].sort((a, b) =>
					a.channel.localeCompare(b.channel),
				),
			);

	const update = async (changes: {
		links?: readonly BridgeLink[];
		enabled?: boolean;
		mirrorModeration?: boolean;
	}) => {
		setBusy(true);
		try {
			const res = await client().call(colibri.bridge.update.main, {
				body: {
					community: props.registration.community,
					registration: props.registration.id,
					...(changes.links ? { links: [...changes.links] } : {}),
					...(changes.enabled === undefined
						? {}
						: { enabled: changes.enabled }),
					...(changes.mirrorModeration === undefined
						? {}
						: { mirrorModeration: changes.mirrorModeration }),
				},
			});
			if (!res.ok) {
				showError(res.error, { fallbackTitle: "Failed to update the bridge." });
				return;
			}
			props.onChanged();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div class="flex flex-col gap-4 rounded-lg border border-border p-4">
			<div class="flex flex-wrap items-center gap-2">
				<PlugsConnectedIcon />
				<div class="flex flex-col flex-1 min-w-0">
					<span class="font-medium truncate">
						{props.registration.remoteSpaceName}
					</span>
					<span class="text-xs text-muted-foreground truncate">
						{platformName(props.registration.platform)} bridge run by{" "}
						{props.registration.bridgeHandle ?? props.registration.bridge}
					</span>
				</div>
				<RevokeBridgeDialog
					registration={props.registration}
					onRevoked={props.onChanged}
				/>
			</div>

			<SwitchComp
				checked={props.registration.enabled}
				disabled={busy()}
				onChange={(enabled) => void update({ enabled })}
				class="flex justify-between items-center gap-x-2"
			>
				<div>
					<SwitchLabel>Relay messages</SwitchLabel>
					<SwitchDescription>
						Pausing keeps the linked channels, so you can resume later.
					</SwitchDescription>
				</div>
				<SwitchInput />
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</SwitchComp>

			<SwitchComp
				checked={props.registration.mirrorModeration ?? false}
				disabled={busy()}
				onChange={(mirrorModeration) => void update({ mirrorModeration })}
				class="flex justify-between items-center gap-x-2"
			>
				<div>
					<SwitchLabel>Mirror moderation</SwitchLabel>
					<SwitchDescription>
						Hiding a relayed message here also removes it on{" "}
						{platformName(props.registration.platform)}, and messages its
						moderators remove are hidden here. The bridge needs permission to
						manage messages there.
					</SwitchDescription>
				</div>
				<SwitchInput />
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</SwitchComp>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium">Linked channels</span>
				<Switch>
					<Match when={rooms.error !== undefined}>
						<ErrorState error={rooms.error} />
					</Match>
					<Match when={rooms.loading}>
						<Spinner />
					</Match>
					<Match when={(rooms() ?? []).length === 0}>
						<p class="m-0 text-sm text-muted-foreground">
							The bridge has not reported any rooms yet. Make sure it is running
							and can see the channels on{" "}
							{platformName(props.registration.platform)}.
						</p>
					</Match>
					<Match when={rooms()}>
						<For each={textChannels()}>
							{(channel) => (
								<div class="flex flex-col gap-1">
									<div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
										<span class="text-sm sm:w-48 truncate">
											#{channel.name}
										</span>
										<Select<RoomOption>
											class="flex-1"
											options={roomOptions()}
											optionValue="id"
											optionTextValue="label"
											value={linkedRoom(channel.space)}
											onChange={(option) => setRoom(channel.space, option)}
											disallowEmptySelection={true}
											itemComponent={(itemProps) => (
												<SelectItem item={itemProps.item}>
													{itemProps.item.rawValue.label}
												</SelectItem>
											)}
										>
											<SelectTrigger
												class="w-full"
												aria-label={`Room linked to ${channel.name}`}
											>
												<SelectValue<RoomOption>>
													{(state) => state.selectedOption()?.label}
												</SelectValue>
											</SelectTrigger>
											<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
										</Select>
										<Show
											when={links().some(
												(link) => link.channel === channel.space,
											)}
										>
											<Select<DepthOption>
												class="sm:w-40"
												options={[...HISTORY_DEPTHS]}
												optionValue="id"
												optionTextValue="label"
												value={depthOf(channel.space)}
												onChange={(option) => setDepth(channel.space, option)}
												disallowEmptySelection={true}
												itemComponent={(itemProps) => (
													<SelectItem item={itemProps.item}>
														{itemProps.item.rawValue.label}
													</SelectItem>
												)}
											>
												<SelectTrigger
													class="w-full"
													aria-label={`Import earlier messages into ${channel.name}`}
												>
													<SelectValue<DepthOption>>
														{(state) => state.selectedOption()?.label}
													</SelectValue>
												</SelectTrigger>
												<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
											</Select>
										</Show>
									</div>
									<Show when={historyOf(channel.space)}>
										{(status) => (
											<div class="sm:pl-52">
												<HistoryStatus status={status()} />
											</div>
										)}
									</Show>
								</div>
							)}
						</For>
						<div class="flex justify-end gap-2">
							<Button
								variant="secondary"
								disabled={!edited() || busy()}
								onClick={() => {
									setLinks(props.registration.links);
									setDepths({});
								}}
							>
								Reset
							</Button>
							<Button
								disabled={!edited() || busy()}
								onClick={() => void update({ links: requested() })}
							>
								Save links
							</Button>
						</div>
					</Match>
				</Switch>
			</div>
		</div>
	);
};

export const BridgesSettingsPage: Component = () => {
	const community = useCommunityContext();
	const client = useManagingClient();
	const [loading] = createSignal(false);

	const [registrations, { refetch }] = createResource(
		() => community().community.did,
		async (did) => {
			const res = await client().call(colibri.bridge.listRegistrations.main, {
				params: { community: did },
			});
			if (!res.ok) throw res.error;
			return res.data.registrations;
		},
	);

	return (
		<SettingsPage
			loading={loading}
			title="Bridges"
			description="Relay channels to a server or workspace on another chat service. Start pairing from the other service, then enter the code it gives you."
		>
			<PairingForm onConnected={() => void refetch()} />
			<Switch>
				<Match when={registrations.error !== undefined}>
					<ErrorState
						error={registrations.error}
						retry={() => void refetch()}
					/>
				</Match>
				<Match when={registrations.loading}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={registrations()}>
					{(list) => (
						<For
							each={list()}
							fallback={
								<p class="m-0 text-sm text-muted-foreground">
									No bridges are connected to this community.
								</p>
							}
						>
							{(registration) => (
								<RegistrationCard
									registration={registration}
									onChanged={() => void refetch()}
								/>
							)}
						</For>
					)}
				</Match>
			</Switch>
		</SettingsPage>
	);
};

import { HourglassLineIcon } from "@solar-icons/solid/bold/hourglass-line";
import { createUniqueId, For, type JSX, Match, Show, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import {
	Select,
	type SelectOption,
	type SelectPlatform,
} from "../Select/Select";
import { Skeleton, SkeletonGroup } from "../Skeleton/Skeleton";
import { SettingsNotice } from "./SettingsNotice";

export const BRIDGE_UNLINKED = "unlinked";
export const BRIDGE_OPEN = "open";

export const BRIDGE_HISTORY_DEPTHS = [
	{ value: "none", label: "Don't import" },
	{ value: "day", label: "Last day" },
	{ value: "week", label: "Last 7 days" },
	{ value: "month", label: "Last 30 days" },
	{ value: "all", label: "All history" },
] as const;

export type BridgeHistoryDepth =
	(typeof BRIDGE_HISTORY_DEPTHS)[number]["value"];

export type BridgeRoom = {
	id: string;
	name: string;
	parent?: string;
};

export type BridgeHistoryImport = {
	depth: BridgeHistoryDepth;
	requestedAt: Date | string;
	state: "running" | "done" | "failed";
	imported: number;
	progress?: number;
	reached?: Date | string;
};

export type BridgeLinkChannel = {
	id: string;
	name: string;
	room: string;
	history?: BridgeHistoryDepth;
	saved?: BridgeHistoryImport;
};

export type BridgeLinksProps = {
	platform?: SelectPlatform;
	channels: readonly BridgeLinkChannel[];
	rooms: readonly BridgeRoom[];
	awaitingRooms?: boolean;
	loading?: boolean;
	error?: string;
	disabled?: boolean;
	title?: string;
	headingLevel?: 2 | 3;
	intro?: JSX.Element;
	onRoomChange?: (channel: string, room: string) => void;
	onHistoryChange?: (channel: string, depth: BridgeHistoryDepth) => void;
	class?: string;
};

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

const formatDate = (value: Date | string) => {
	return dateFormat.format(value instanceof Date ? value : new Date(value));
};

const clampPercent = (value: number | undefined) => {
	return Math.round(Math.min(100, Math.max(0, value ?? 0)));
};

const importLabel = (saved: BridgeHistoryImport) => {
	const date = formatDate(saved.requestedAt);
	const count = numberFormat.format(saved.imported);

	if (saved.state === "done") return `Imported ${date}, ${count} messages.`;
	if (saved.state === "failed") {
		return `The import from ${date} stopped after ${count} messages. Choose a range again to retry.`;
	}

	const reached = saved.reached ? `, up to ${formatDate(saved.reached)}` : "";

	return `Importing since ${date}: ${clampPercent(saved.progress)}%, ${count} messages${reached}.`;
};

const roomLabel = (room: BridgeRoom) => {
	return room.parent ? `${room.name} (${room.parent})` : room.name;
};

const historyOptions: SelectOption[] = BRIDGE_HISTORY_DEPTHS.map((depth) => ({
	value: depth.value,
	label: depth.label,
}));

const linkedToRoom = (channel: BridgeLinkChannel) => {
	return channel.room !== BRIDGE_UNLINKED && channel.room !== BRIDGE_OPEN;
};

const ImportStatus = (props: { saved: BridgeHistoryImport }) => (
	<div data-bridge-import={props.saved.state} class="flex flex-col gap-1">
		<Show when={props.saved.state === "running"}>
			<div
				role="progressbar"
				aria-label="History import"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={clampPercent(props.saved.progress)}
				class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
			>
				<div
					class="h-full rounded-full bg-primary"
					style={{ width: `${clampPercent(props.saved.progress)}%` }}
				/>
			</div>
		</Show>
		<span
			class={cx(
				"text-xs text-pretty",
				props.saved.state === "failed"
					? "text-destructive"
					: "text-muted-foreground",
			)}
		>
			{importLabel(props.saved)}
		</span>
	</div>
);

const ChannelRow = (props: {
	channel: BridgeLinkChannel;
	platform?: SelectPlatform;
	roomOptions: SelectOption[];
	disabled?: boolean;
	onRoomChange?: (channel: string, room: string) => void;
	onHistoryChange?: (channel: string, depth: BridgeHistoryDepth) => void;
}) => {
	const historyValue = () => {
		return props.channel.history ?? props.channel.saved?.depth ?? "none";
	};
	const requested = () => {
		return !!props.channel.history && props.channel.history !== "none";
	};

	return (
		<div data-bridge-link="" class="flex min-w-0 flex-col gap-2">
			<Select
				platform={props.platform}
				label={`#${props.channel.name}`}
				aria-label={`Room linked to ${props.channel.name}`}
				options={props.roomOptions}
				value={props.channel.room}
				onChange={(room) => props.onRoomChange?.(props.channel.id, room)}
				disabled={props.disabled}
			/>
			<Show when={linkedToRoom(props.channel)}>
				<Select
					platform={props.platform}
					aria-label={`Import earlier messages into ${props.channel.name}`}
					options={historyOptions}
					value={historyValue()}
					reselect={!!props.channel.saved}
					onChange={(depth) =>
						props.onHistoryChange?.(
							props.channel.id,
							depth as BridgeHistoryDepth,
						)
					}
					disabled={props.disabled}
				/>
				<Switch>
					<Match when={requested() && props.channel.saved}>
						<span class="text-xs text-pretty text-muted-foreground">
							A new import starts when you save.
						</span>
					</Match>
					<Match when={props.channel.saved}>
						{(saved) => <ImportStatus saved={saved()} />}
					</Match>
				</Switch>
			</Show>
		</div>
	);
};

const LinksSkeleton = () => (
	<SkeletonGroup label="Loading channels" class="flex flex-col gap-4">
		<For each={[0, 1, 2]}>
			{() => (
				<div class="flex flex-col gap-2">
					<Skeleton class="h-5 w-24 rounded-control-sm" />
					<Skeleton class="h-10 w-full rounded-control" />
				</div>
			)}
		</For>
	</SkeletonGroup>
);

export const BridgeLinks = (props: BridgeLinksProps) => {
	const headingId = createUniqueId();
	const awaiting = () => props.awaitingRooms ?? props.rooms.length === 0;
	const roomOptions = (): SelectOption[] => [
		{ value: BRIDGE_UNLINKED, label: "Not linked" },
		{ value: BRIDGE_OPEN, label: "Let the bridge read and reply" },
		...props.rooms.map((room) => ({ value: room.id, label: roomLabel(room) })),
	];

	return (
		<section
			data-bridge-links=""
			aria-labelledby={headingId}
			class={cx("flex min-w-0 flex-col gap-3", props.class)}
		>
			<Dynamic
				component={props.headingLevel === 3 ? "h3" : "h2"}
				id={headingId}
				class="m-0 text-sm font-semibold"
			>
				{props.title ?? "Linked channels"}
			</Dynamic>
			<Switch>
				<Match when={props.error}>
					{(error) => (
						<p role="alert" class="m-0 text-sm text-destructive">
							{error()}
						</p>
					)}
				</Match>
				<Match when={props.loading}>
					<LinksSkeleton />
				</Match>
				<Match when={true}>
					<Show when={props.intro}>
						<p class="m-0 text-sm text-pretty text-muted-foreground">
							{props.intro}
						</p>
					</Show>
					<Show when={awaiting()}>
						<SettingsNotice
							icon={<HourglassLineIcon />}
							title="Waiting for the bridge to report its channels"
							description="This usually takes a moment. Until then, you can let the bridge read and reply in a channel, or leave it unlinked."
						/>
					</Show>
					<div class="flex flex-col gap-4">
						<For each={props.channels}>
							{(channel) => (
								<ChannelRow
									channel={channel}
									platform={props.platform}
									roomOptions={roomOptions()}
									disabled={props.disabled}
									onRoomChange={props.onRoomChange}
									onHistoryChange={props.onHistoryChange}
								/>
							)}
						</For>
					</div>
				</Match>
			</Switch>
		</section>
	);
};

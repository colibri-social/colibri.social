import { MonitorIcon } from "@solar-icons/solid/bold/monitor";
import { WindowFrameIcon } from "@solar-icons/solid/bold/window-frame";
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
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { ListGroup, ToggleRow } from "../List/List";
import { Modal, ModalContent } from "../Modal/Modal";
import { Select, type SelectPlatform } from "../Select/Select";
import {
	SCREEN_SHARE_FRAMERATES,
	SCREEN_SHARE_RESOLUTIONS,
	type ScreenShareFramerate,
	type ScreenShareResolution,
	type ScreenShareSettings,
	screenShareFramerateLabel,
	screenShareResolutionLabel,
} from "../SettingsPages/VoiceVideoSettings";
import { Skeleton } from "../Skeleton/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Tabs/Tabs";

export type ScreenShareSourceKind = "application" | "window" | "display";

export type ScreenShareSource = {
	id: string;
	kind: ScreenShareSourceKind;
	name: string;
	application?: string | null;
	thumbnail?: string;
	aspectRatio?: number;
};

export type ScreenSharePickerMode = "native" | "browser";

export type ScreenSharePickerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: ScreenSharePickerMode;
	platform?: SelectPlatform;
	sources?: readonly ScreenShareSource[];
	loading?: boolean;
	failed?: boolean;
	onRetry?: () => void;
	settings: ScreenShareSettings;
	onSettingsChange: (patch: Partial<ScreenShareSettings>) => void;
	onShare: (source?: ScreenShareSource) => void;
	onOpenPermissionSettings?: () => void;
};

export const SCREEN_SHARE_PICKER_COPY = {
	title: "Share your screen",
	nativeDescription: "Pick what everyone in the call sees.",
	browserDescription:
		"Choose the quality first. Your browser asks what to share next.",
	share: "Share",
	continue: "Continue",
	cancel: "Cancel",
	failed: "Colibri couldn't see your screens and windows.",
	failedHint:
		"Check that Colibri is allowed to record your screen, then try again.",
	retry: "Try again",
	openSettings: "Open settings",
	quality:
		"Higher settings look sharper and smoother, but need a faster connection.",
	sound: "Share sound",
	soundDescription: "Others hear what's playing on your screen.",
} as const;

const TABS: { kind: ScreenShareSourceKind; label: string; empty: string }[] = [
	{
		kind: "application",
		label: "Apps",
		empty: "No apps with open windows.",
	},
	{ kind: "window", label: "Windows", empty: "No windows to share." },
	{ kind: "display", label: "Screens", empty: "No screens to share." },
];

const SKELETON_TILES = [0, 1, 2, 3, 4, 5];

const SourceTile = (props: {
	source: ScreenShareSource;
	selected: boolean;
	onSelect: () => void;
	onShare: () => void;
}) => (
	<button
		type="button"
		data-screen-source={props.source.id}
		aria-pressed={props.selected}
		onClick={() => props.onSelect()}
		onDblClick={() => props.onShare()}
		class={cx(
			"group flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-surface border-0 bg-transparent p-1.5 text-left outline-none focus-ring",
			"hover:bg-secondary",
			props.selected && "bg-secondary",
		)}
	>
		<span
			class={cx(
				"flex aspect-video w-full items-center justify-center overflow-hidden rounded-control border bg-muted text-muted-foreground [&_svg]:size-8",
				props.selected
					? "border-primary ring-2 ring-primary/40"
					: "border-border",
			)}
		>
			<Show
				when={props.source.thumbnail}
				fallback={
					props.source.kind === "display" ? (
						<MonitorIcon />
					) : (
						<WindowFrameIcon />
					)
				}
			>
				{(src) => (
					<img
						src={src()}
						alt=""
						draggable={false}
						class="max-h-full max-w-full object-contain"
						style={
							props.source.aspectRatio
								? { "aspect-ratio": String(props.source.aspectRatio) }
								: undefined
						}
					/>
				)}
			</Show>
		</span>
		<span class="flex min-w-0 flex-col px-0.5">
			<span class="truncate text-sm font-semibold">{props.source.name}</span>
			<Show
				when={
					props.source.application &&
					props.source.application !== props.source.name
						? props.source.application
						: undefined
				}
			>
				{(application) => (
					<span class="truncate text-xs text-muted-foreground">
						{application()}
					</span>
				)}
			</Show>
		</span>
	</button>
);

const SourceSkeletons = () => (
	<div
		data-screen-sources-loading=""
		class="grid grid-cols-2 gap-1 md:grid-cols-3"
	>
		<For each={SKELETON_TILES}>
			{() => (
				<span class="flex flex-col gap-1.5 p-1.5">
					<Skeleton class="aspect-video w-full rounded-control" />
					<Skeleton width="60%" height={12} />
				</span>
			)}
		</For>
	</div>
);

const QualityFields = (props: {
	platform?: SelectPlatform;
	settings: ScreenShareSettings;
	onSettingsChange: (patch: Partial<ScreenShareSettings>) => void;
}) => (
	<div class="flex flex-col gap-3" data-screen-share-quality="">
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<Select
				platform={props.platform}
				label="Resolution"
				options={SCREEN_SHARE_RESOLUTIONS.map((resolution) => ({
					value: resolution,
					label: screenShareResolutionLabel(resolution),
				}))}
				value={props.settings.resolution}
				onChange={(value) =>
					props.onSettingsChange({
						resolution: value as ScreenShareResolution,
					})
				}
			/>
			<Select
				platform={props.platform}
				label="Frame rate"
				options={SCREEN_SHARE_FRAMERATES.map((framerate) => ({
					value: String(framerate),
					label: screenShareFramerateLabel(framerate),
				}))}
				value={String(props.settings.framerate)}
				onChange={(value) =>
					props.onSettingsChange({
						framerate: Number(value) as ScreenShareFramerate,
					})
				}
			/>
		</div>
		<p class="m-0 text-xs text-muted-foreground">
			{SCREEN_SHARE_PICKER_COPY.quality}
		</p>
		<Show when={props.settings.shareAudio !== undefined}>
			<ListGroup>
				<ToggleRow
					title={SCREEN_SHARE_PICKER_COPY.sound}
					description={SCREEN_SHARE_PICKER_COPY.soundDescription}
					checked={props.settings.shareAudio}
					onChange={(checked) =>
						props.onSettingsChange({ shareAudio: checked })
					}
				/>
			</ListGroup>
		</Show>
	</div>
);

export const ScreenSharePicker = (props: ScreenSharePickerProps) => {
	const [tab, setTab] = createSignal<ScreenShareSourceKind>("application");
	const [selectedId, setSelectedId] = createSignal<string>();
	const sources = () => props.sources ?? [];
	const ofKind = (kind: ScreenShareSourceKind) =>
		sources().filter((source) => source.kind === kind);
	const selected = createMemo(() =>
		sources().find((source) => source.id === selectedId()),
	);
	const native = () => props.mode === "native";

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (!open) return;
				setSelectedId(undefined);
			},
		),
	);

	createEffect(
		on(
			() => [props.open, props.sources] as const,
			([open]) => {
				if (!open || ofKind(tab()).length > 0) return;
				const first = TABS.find((entry) => ofKind(entry.kind).length > 0);
				if (first) setTab(first.kind);
			},
		),
	);

	const share = (source?: ScreenShareSource) => {
		if (native() && !source) return;
		props.onShare(source);
	};

	return (
		<Modal open={props.open} onOpenChange={props.onOpenChange}>
			<ModalContent
				title={SCREEN_SHARE_PICKER_COPY.title}
				description={
					native()
						? SCREEN_SHARE_PICKER_COPY.nativeDescription
						: SCREEN_SHARE_PICKER_COPY.browserDescription
				}
				class={native() ? "md:w-[640px]" : "md:w-[440px]"}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => props.onOpenChange(false)}
						>
							{SCREEN_SHARE_PICKER_COPY.cancel}
						</Button>
						<Button
							data-screen-share-confirm=""
							disabled={native() && !selected()}
							onClick={() => share(selected())}
						>
							{native()
								? SCREEN_SHARE_PICKER_COPY.share
								: SCREEN_SHARE_PICKER_COPY.continue}
						</Button>
					</>
				}
			>
				<Show when={native()}>
					<Tabs
						value={tab()}
						onChange={(value) => setTab(value as ScreenShareSourceKind)}
						class="flex min-h-0 flex-col gap-2"
					>
						<TabsList>
							<For each={TABS}>
								{(entry) => (
									<TabsTrigger value={entry.kind}>{entry.label}</TabsTrigger>
								)}
							</For>
						</TabsList>
						<div class="-mx-1.5 max-h-[min(50dvh,360px)] min-h-[180px] overflow-y-auto">
							<Switch>
								<Match when={props.failed}>
									<div
										data-screen-sources-failed=""
										class="flex min-h-[180px] flex-col items-center justify-center gap-3 px-4 text-center"
									>
										<p class="m-0 text-sm font-semibold text-balance">
											{SCREEN_SHARE_PICKER_COPY.failed}
										</p>
										<p class="m-0 -mt-2 text-sm text-pretty text-muted-foreground">
											{SCREEN_SHARE_PICKER_COPY.failedHint}
										</p>
										<div class="flex gap-2">
											<Show when={props.onOpenPermissionSettings}>
												{(open) => (
													<Button variant="secondary" onClick={() => open()()}>
														{SCREEN_SHARE_PICKER_COPY.openSettings}
													</Button>
												)}
											</Show>
											<Show when={props.onRetry}>
												{(retry) => (
													<Button variant="secondary" onClick={() => retry()()}>
														{SCREEN_SHARE_PICKER_COPY.retry}
													</Button>
												)}
											</Show>
										</div>
									</div>
								</Match>
								<Match when={props.loading && sources().length === 0}>
									<SourceSkeletons />
								</Match>
								<Match when={true}>
									<For each={TABS}>
										{(entry) => (
											<TabsContent value={entry.kind}>
												<Show
													when={ofKind(entry.kind).length > 0}
													fallback={
														<p class="m-0 flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
															{entry.empty}
														</p>
													}
												>
													<div
														data-screen-sources={entry.kind}
														class="grid grid-cols-2 gap-1 md:grid-cols-3"
													>
														<For each={ofKind(entry.kind)}>
															{(source) => (
																<SourceTile
																	source={source}
																	selected={selectedId() === source.id}
																	onSelect={() => setSelectedId(source.id)}
																	onShare={() => share(source)}
																/>
															)}
														</For>
													</div>
												</Show>
											</TabsContent>
										)}
									</For>
								</Match>
							</Switch>
						</div>
					</Tabs>
				</Show>
				<QualityFields
					platform={props.platform}
					settings={props.settings}
					onSettingsChange={props.onSettingsChange}
				/>
			</ModalContent>
		</Modal>
	);
};

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
import {
	CheckboxRow,
	ListGroup,
	RadioRow,
	RadioRowGroup,
	ToggleRow,
} from "../List/List";
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

export type ScreenSharePickerMode = "native" | "browser" | "system";

export type ScreenShareSurface = "screen" | "window";

export const SCREEN_SHARE_SURFACES: readonly ScreenShareSurface[] = [
	"screen",
	"window",
];

const isSurface = (value: string): value is ScreenShareSurface =>
	(SCREEN_SHARE_SURFACES as readonly string[]).includes(value);

export type ScreenShareAudioApp = {
	id: string;
	name: string;
	router?: boolean;
};

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
	surface?: ScreenShareSurface;
	onSurfaceChange?: (surface: ScreenShareSurface) => void;
	audioApps?: readonly ScreenShareAudioApp[];
	audioApp?: string;
	onAudioAppChange?: (id: string | undefined) => void;
	excludedAudioApps?: readonly string[];
	onExcludedAudioAppsChange?: (ids: string[]) => void;
};

const NO_AUDIO_APP = "none";

export const SCREEN_SHARE_PICKER_COPY = {
	title: "Share your screen",
	nativeDescription: "Pick what everyone in the call sees.",
	browserDescription:
		"Choose the quality first. Your browser asks what to share next.",
	systemDescription:
		"Choose what to share and how sharp it looks. Your computer asks which one next.",
	surface: "What to share",
	surfaces: {
		screen: {
			title: "Whole screen",
			description: "Everyone sees everything on one of your screens.",
		},
		window: {
			title: "One window",
			description: "Everyone sees only the window you pick.",
		},
	},
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
	soundFrom: "Sound from",
	noSound: "No sound",
	routerNote:
		"Some apps that route your sound are turned off so others don't hear themselves.",
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
						class="size-full object-cover"
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
	audioApps?: readonly ScreenShareAudioApp[];
	audioApp?: string;
	onAudioAppChange?: (id: string | undefined) => void;
	screenAudioApps?: readonly ScreenShareAudioApp[];
	excludedAudioApps?: readonly string[];
	onExcludedAudioAppsChange?: (ids: string[]) => void;
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
		<Show when={props.settings.shareAudio ? props.audioApps : undefined}>
			{(apps) => (
				<div data-screen-share-audio-app="">
					<Select
						platform={props.platform}
						label={SCREEN_SHARE_PICKER_COPY.soundFrom}
						options={[
							{ value: NO_AUDIO_APP, label: SCREEN_SHARE_PICKER_COPY.noSound },
							...apps().map((app) => ({ value: app.id, label: app.name })),
						]}
						value={props.audioApp ?? NO_AUDIO_APP}
						onChange={(value) =>
							props.onAudioAppChange?.(
								value === NO_AUDIO_APP ? undefined : value,
							)
						}
					/>
				</div>
			)}
		</Show>
		<Show when={props.settings.shareAudio ? props.screenAudioApps : undefined}>
			{(apps) => (
				<div data-screen-share-audio-apps="" class="flex flex-col gap-2">
					<ListGroup label={SCREEN_SHARE_PICKER_COPY.soundFrom}>
						<For each={apps()}>
							{(app) => (
								<CheckboxRow
									label={app.name}
									value={app.id}
									checked={!props.excludedAudioApps?.includes(app.id)}
									onChange={(checked) => {
										const others = (props.excludedAudioApps ?? []).filter(
											(id) => id !== app.id,
										);
										props.onExcludedAudioAppsChange?.(
											checked ? others : [...others, app.id],
										);
									}}
								/>
							)}
						</For>
					</ListGroup>
					<p class="m-0 text-xs text-pretty text-muted-foreground">
						{SCREEN_SHARE_PICKER_COPY.routerNote}
					</p>
				</div>
			)}
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
	const surface = () => props.surface ?? "screen";
	const audioApps = () =>
		props.mode === "system" && surface() === "window"
			? props.audioApps
			: undefined;
	const wholeScreen = () =>
		native()
			? selected()?.kind === "display"
			: props.mode === "system" && surface() === "screen";
	const screenAudioApps = () =>
		wholeScreen() && props.audioApps?.some((app) => app.router)
			? props.audioApps
			: undefined;

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
						: props.mode === "system"
							? SCREEN_SHARE_PICKER_COPY.systemDescription
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
				<div
					data-screen-share-body=""
					class="-mx-4 -my-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-1"
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
														<Button
															variant="secondary"
															onClick={() => open()()}
														>
															{SCREEN_SHARE_PICKER_COPY.openSettings}
														</Button>
													)}
												</Show>
												<Show when={props.onRetry}>
													{(retry) => (
														<Button
															variant="secondary"
															onClick={() => retry()()}
														>
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
					<Show when={props.mode === "system"}>
						<RadioRowGroup
							label={SCREEN_SHARE_PICKER_COPY.surface}
							value={surface()}
							onChange={(value) => {
								if (isSurface(value)) props.onSurfaceChange?.(value);
							}}
						>
							<For each={SCREEN_SHARE_SURFACES}>
								{(surface) => (
									<RadioRow
										value={surface}
										icon={
											surface === "screen" ? (
												<MonitorIcon />
											) : (
												<WindowFrameIcon />
											)
										}
										title={SCREEN_SHARE_PICKER_COPY.surfaces[surface].title}
										description={
											SCREEN_SHARE_PICKER_COPY.surfaces[surface].description
										}
									/>
								)}
							</For>
						</RadioRowGroup>
					</Show>
					<QualityFields
						platform={props.platform}
						settings={props.settings}
						onSettingsChange={props.onSettingsChange}
						audioApps={audioApps()}
						audioApp={props.audioApp}
						onAudioAppChange={props.onAudioAppChange}
						screenAudioApps={screenAudioApps()}
						excludedAudioApps={props.excludedAudioApps}
						onExcludedAudioAppsChange={props.onExcludedAudioAppsChange}
					/>
				</div>
			</ModalContent>
		</Modal>
	);
};

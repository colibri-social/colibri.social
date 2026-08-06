import type { Component } from "solid-js";
import {
	createEffect,
	createResource,
	createSignal,
	For,
	onCleanup,
	Show,
	Suspense,
} from "solid-js";
import { cx } from "../../../utils/cva";
import type {
	NativeCaptureSource,
	NativeSourceKind,
} from "../../../utils/native-capture";
import {
	listNativeCaptureSources,
	nativeThumbnailUrl,
	openScreenRecordingSettings,
	previewAspectRatio,
} from "../../../utils/native-capture";
import {
	framerateLabel,
	resolutionLabel,
	SCREEN_FRAMERATES,
	SCREEN_RESOLUTIONS,
	type ScreenFramerate,
	type ScreenResolution,
	type ScreenShareOptions,
} from "../../../utils/screen-share";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/Dialog";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../ui/Select";
import {
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../ui/Switch";
import {
	Tabs,
	TabsContent,
	TabsIndicator,
	TabsList,
	TabsTrigger,
} from "../../ui/Tabs";

type SourceListing = { sources: NativeCaptureSource[]; failed: boolean };
type ResolutionOption = { id: ScreenResolution; name: string };
type FramerateOption = { id: ScreenFramerate; name: string };

const RESOLUTION_OPTIONS: ResolutionOption[] = SCREEN_RESOLUTIONS.map((id) => ({
	id,
	name: resolutionLabel(id),
}));

const FRAMERATE_OPTIONS: FramerateOption[] = SCREEN_FRAMERATES.map((id) => ({
	id,
	name: framerateLabel(id),
}));

const TABS: Array<{ id: NativeSourceKind; label: string; empty: string }> = [
	{
		id: "application",
		label: "Applications",
		empty: "No apps with open windows.",
	},
	{ id: "window", label: "Windows", empty: "No shareable windows." },
	{ id: "display", label: "Screens", empty: "No screens found." },
];

const SourceThumbnail: Component<{ source: NativeCaptureSource }> = (props) => {
	const [url, setUrl] = createSignal<string | null>(null);

	createEffect(() => {
		if (!props.source.hasThumbnail) return;
		let stale = false;
		onCleanup(() => {
			stale = true;
		});
		void nativeThumbnailUrl(props.source.id)
			.then((value) => {
				if (!stale) setUrl(value);
			})
			.catch(() => {});
	});

	return (
		<div
			class="w-full rounded-sm bg-muted/60 overflow-hidden flex items-center justify-center"
			style={{ "aspect-ratio": previewAspectRatio(props.source) }}
		>
			<Show
				when={url()}
				fallback={
					<span class="text-xs text-muted-foreground px-2 text-center">
						No preview
					</span>
				}
			>
				{(src) => (
					<img
						src={src()}
						alt=""
						class="w-full h-full object-cover"
						draggable={false}
					/>
				)}
			</Show>
		</div>
	);
};

export interface NativeScreenPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: ScreenShareOptions;
	onChange: (patch: Partial<ScreenShareOptions>) => void;
	onConfirm: (source: NativeCaptureSource) => void;
}

export const NativeScreenPicker: Component<NativeScreenPickerProps> = (
	props,
) => {
	const [selected, setSelected] = createSignal<NativeCaptureSource | null>(
		null,
	);

	const [sources, { refetch }] = createResource(
		() => props.open,
		async (open): Promise<SourceListing> => {
			if (!open) return { sources: [], failed: false };
			try {
				return { sources: await listNativeCaptureSources(), failed: false };
			} catch {
				return { sources: [], failed: true };
			}
		},
	);

	const forKind = (kind: NativeSourceKind): NativeCaptureSource[] =>
		(sources()?.sources ?? []).filter((source) => source.kind === kind);

	const confirm = (): void => {
		const source = selected();
		if (source) props.onConfirm(source);
	};

	return (
		<ResponsiveDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			title="Share your screen"
			contentClass="sm:max-w-2xl"
		>
			<div class="flex flex-col gap-4">
				<Tabs defaultValue="application">
					<TabsList>
						<For each={TABS}>
							{(tab) => <TabsTrigger value={tab.id}>{tab.label}</TabsTrigger>}
						</For>
						<TabsIndicator />
					</TabsList>

					<For each={TABS}>
						{(tab) => (
							<TabsContent value={tab.id} class="min-h-72">
								<Suspense
									fallback={
										<div class="flex items-center justify-center py-10">
											<Spinner />
										</div>
									}
								>
									<Show
										when={forKind(tab.id).length > 0}
										fallback={
											<p class="text-sm text-muted-foreground text-center py-10 m-0">
												{sources()?.failed
													? "Colibri could not read what is on screen. Turn on Screen & System Audio Recording for Colibri in System Settings, then reopen this window."
													: tab.empty}
											</p>
										}
									>
										<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 items-start max-h-72 overflow-y-auto pr-1">
											<For each={forKind(tab.id)}>
												{(source) => (
													<button
														type="button"
														onClick={() => setSelected(source)}
														onDblClick={() => {
															setSelected(source);
															confirm();
														}}
														class={cx(
															"flex flex-col gap-1.5 p-1.5 rounded-md border text-left cursor-pointer transition-colors",
															selected()?.id === source.id
																? "border-primary bg-primary/10"
																: "border-transparent hover:bg-muted/50",
														)}
													>
														<SourceThumbnail source={source} />
														<span class="text-xs font-medium truncate">
															{source.name}
														</span>
														<Show when={source.application}>
															{(app) => (
																<span class="text-xs text-muted-foreground truncate -mt-1">
																	{app()}
																</span>
															)}
														</Show>
													</button>
												)}
											</For>
										</div>
									</Show>
								</Suspense>
							</TabsContent>
						)}
					</For>
				</Tabs>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<Select
						options={RESOLUTION_OPTIONS}
						optionValue={"id" as never}
						optionTextValue={"name" as never}
						value={RESOLUTION_OPTIONS.find(
							(o) => o.id === props.value.resolution,
						)}
						disallowEmptySelection={true}
						itemComponent={(itemProps) => (
							<SelectItem
								item={itemProps.item}
								onClick={() =>
									props.onChange({
										resolution: (
											itemProps.item.rawValue as unknown as ResolutionOption
										).id,
									})
								}
							>
								{(itemProps.item.rawValue as unknown as ResolutionOption).name}
							</SelectItem>
						)}
					>
						<SelectLabel>Resolution</SelectLabel>
						<SelectTrigger class="w-full" aria-label="Resolution">
							<SelectValue<ResolutionOption>>
								{(state) => state.selectedOption()?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
					</Select>

					<Select
						options={FRAMERATE_OPTIONS}
						optionValue={"id" as never}
						optionTextValue={"name" as never}
						value={FRAMERATE_OPTIONS.find(
							(o) => o.id === props.value.framerate,
						)}
						disallowEmptySelection={true}
						itemComponent={(itemProps) => (
							<SelectItem
								item={itemProps.item}
								onClick={() =>
									props.onChange({
										framerate: (
											itemProps.item.rawValue as unknown as FramerateOption
										).id,
									})
								}
							>
								{(itemProps.item.rawValue as unknown as FramerateOption).name}
							</SelectItem>
						)}
					>
						<SelectLabel>Frame rate</SelectLabel>
						<SelectTrigger class="w-full" aria-label="Frame rate">
							<SelectValue<FramerateOption>>
								{(state) => state.selectedOption()?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
					</Select>
				</div>

				<Toggle
					class="flex flex-row gap-4 items-center w-full justify-between shrink-0"
					checked={props.value.shareAudio}
					onChange={(checked) => props.onChange({ shareAudio: checked })}
				>
					<div>
						<SwitchLabel>Share sound</SwitchLabel>
						<SwitchDescription>
							Sends audio from what you picked. Colibri's own output is left
							out, and your microphone is unaffected.
						</SwitchDescription>
					</div>
					<div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</div>
				</Toggle>

				<DialogFooter>
					<Show when={sources()?.failed}>
						<Button
							variant="outline"
							onClick={() => void openScreenRecordingSettings()}
						>
							Open System Settings
						</Button>
					</Show>
					<Button variant="outline" onClick={() => void refetch()}>
						Refresh
					</Button>
					<Button disabled={!selected()} onClick={confirm}>
						Go Live
					</Button>
				</DialogFooter>
			</div>
		</ResponsiveDialog>
	);
};

import type { Component } from "solid-js";
import { createResource, createSignal, ErrorBoundary, Show } from "solid-js";
import CaretDownIcon from "~icons/ph/caret-down";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { useVoiceChatContext } from "../../../contexts/VoiceChat";
import { showError } from "../../../errors/show-error";
import { cx } from "../../../utils/cva";
import type { NativeCaptureSource } from "../../../utils/native-capture";
import {
	createNativeCaptureTrack,
	nativeCaptureQuality,
	promptForScreenRecording,
	startNativeCapture,
	stopNativeCapture,
	supportsNativeCapture,
} from "../../../utils/native-capture";
import { isMacOS } from "../../../utils/platform";
import {
	framerateLabel,
	resolutionLabel,
	SCREEN_FRAMERATES,
	SCREEN_RESOLUTIONS,
	type ScreenFramerate,
	type ScreenResolution,
	type ScreenShareOptions,
	supportsDisplayAudio,
	supportsScreenShare,
} from "../../../utils/screen-share";
import { Screen } from "../../icons/Screen";
import { Button, buttonVariants } from "../../ui/Button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroupLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { NativeScreenPicker } from "./NativeScreenPicker";
import { ScreenShareModal } from "./ScreenShareModal";

export interface ScreenShareButtonProps {
	class?: string;
	buttonClass?: string;
}

export const ScreenShareButton: Component<ScreenShareButtonProps> = (props) => {
	const [voiceData, { toggleScreen, shareScreenTrack, applyScreenQuality }] =
		useVoiceChatContext();
	const { preferences, setScreenShare } = useUserPreferences();
	const [modalOpen, setModalOpen] = createSignal(false);
	const [native] = createResource(supportsNativeCapture);

	const enabled = (): boolean => voiceData.states.screenEnabled;
	const audioSupported = (): boolean => native() || supportsDisplayAudio();
	const settings = (): ScreenShareOptions => preferences().voice.screen;

	const effectiveSettings = (): ScreenShareOptions => ({
		...settings(),
		shareAudio: audioSupported() && settings().shareAudio,
	});

	const update = (patch: Partial<ScreenShareOptions>): void => {
		setScreenShare(patch);
		if (patch.resolution === undefined && patch.framerate === undefined) return;
		if (!enabled()) return;

		applyScreenQuality({ ...settings(), ...patch });
	};

	const handleMainClick = async (): Promise<void> => {
		if (enabled()) {
			toggleScreen();
			return;
		}

		if (native() && !(await promptForScreenRecording())) return;

		setModalOpen(true);
	};

	const handleConfirm = (): void => {
		setModalOpen(false);
		toggleScreen(effectiveSettings());
	};

	const onPickerCrash = (error: unknown): null => {
		setModalOpen(false);
		showError(error, {
			fallbackTitle: "The screen share picker couldn't open.",
			description: "Your call is still connected.",
		});
		return null;
	};

	const handleNativeConfirm = async (
		source: NativeCaptureSource,
	): Promise<void> => {
		setModalOpen(false);
		const quality = settings();
		const withAudio = settings().shareAudio;

		try {
			const session = await startNativeCapture(
				source.id,
				nativeCaptureQuality(quality, source.width, source.height),
				withAudio,
			);
			const bridge = await createNativeCaptureTrack(session, withAudio);
			shareScreenTrack(bridge.track, bridge.audioTrack, quality, () => {
				bridge.stop();
				void stopNativeCapture();
			});
		} catch (error) {
			void stopNativeCapture();
			showError(error, {
				fallbackTitle: "Couldn't start sharing your screen.",
				description: isMacOS()
					? "macOS may need Screen & System Audio Recording permission for Colibri."
					: "Your call is still connected. Try picking a different app, window or screen.",
			});
		}
	};

	return (
		<Show when={supportsScreenShare() || native()}>
			<div class={cx("flex items-stretch min-w-0", props.class)}>
				<Button
					variant={enabled() ? "secondary" : "outline"}
					class={cx("gap-2 rounded-r-none flex-1 min-w-0", props.buttonClass)}
					classList={{
						"text-(--primary-hover)!": enabled(),
						"text-foreground": !enabled(),
					}}
					aria-label={enabled() ? "Stop sharing your screen" : "Share screen"}
					onClick={() => void handleMainClick()}
				>
					<Screen enabled={enabled()} />
				</Button>

				<DropdownMenu placement="top-end">
					<DropdownMenuTrigger
						as="button"
						type="button"
						aria-label="Screen share settings"
						class={cx(
							buttonVariants({ variant: enabled() ? "secondary" : "outline" }),
							"rounded-l-none border-l-0 aspect-auto p-0! w-5 shrink-0",
							"aria-expanded:[&>svg]:rotate-180",
						)}
					>
						<CaretDownIcon class="text-sm transition-transform w-3!" />
					</DropdownMenuTrigger>
					<DropdownMenuPortal>
						<DropdownMenuContent class="min-w-44">
							<DropdownMenuRadioGroup
								value={settings().resolution}
								onChange={(value) =>
									update({ resolution: value as ScreenResolution })
								}
							>
								<DropdownMenuGroupLabel>Resolution</DropdownMenuGroupLabel>
								{SCREEN_RESOLUTIONS.map((resolution) => (
									<DropdownMenuRadioItem value={resolution}>
										{resolutionLabel(resolution)}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>

							<DropdownMenuSeparator />

							<DropdownMenuRadioGroup
								value={String(settings().framerate)}
								onChange={(value) =>
									update({
										framerate: Number(value) as ScreenFramerate,
									})
								}
							>
								<DropdownMenuGroupLabel>Frame rate</DropdownMenuGroupLabel>
								{SCREEN_FRAMERATES.map((framerate) => (
									<DropdownMenuRadioItem value={String(framerate)}>
										{framerateLabel(framerate)}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>

							<Show when={audioSupported()}>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={settings().shareAudio}
									disabled={enabled()}
									closeOnSelect={false}
									onChange={(checked) => update({ shareAudio: checked })}
								>
									{enabled() ? "Sound (restart to change)" : "Share sound"}
								</DropdownMenuCheckboxItem>
							</Show>
						</DropdownMenuContent>
					</DropdownMenuPortal>
				</DropdownMenu>

				<ErrorBoundary fallback={onPickerCrash}>
					<Show
						when={native()}
						fallback={
							<ScreenShareModal
								open={modalOpen()}
								onOpenChange={setModalOpen}
								value={settings()}
								audioSupported={audioSupported()}
								onChange={update}
								onConfirm={handleConfirm}
							/>
						}
					>
						<NativeScreenPicker
							open={modalOpen()}
							onOpenChange={setModalOpen}
							value={settings()}
							onChange={update}
							onConfirm={(source) => void handleNativeConfirm(source)}
						/>
					</Show>
				</ErrorBoundary>
			</div>
		</Show>
	);
};

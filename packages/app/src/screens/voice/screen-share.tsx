import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	ConfirmDialog,
	type ScreenShareMenuProps,
	ScreenSharePicker,
	type ScreenShareSettings,
	type ScreenShareSource,
	toast,
} from "@colibri-social/ui";
import {
	createEffect,
	createResource,
	createRoot,
	createSignal,
	on,
} from "solid-js";
import { VOICE_NOTICE_COPY } from "../../data/error-copy";
import {
	displayMediaRequest,
	type ScreenShareOptions,
	supportsDisplayAudio,
	supportsDisplayMedia,
} from "../../data/screen-share";
import { voice } from "../../data/voice";
import { voiceSettings } from "../../data/voice-settings";
import {
	createNativeCaptureTrack,
	listNativeCaptureSources,
	type NativeCaptureSource,
	nativeCapturePermission,
	nativeCaptureQuality,
	nativeThumbnailUrl,
	openScreenRecordingSettings,
	previewAspectRatio,
	startNativeCapture,
	stopNativeCapture,
	supportsNativeCapture,
} from "../../native/screen-capture";
import { usePlatform } from "../../screen/platform";

const log = createLogger("voice/screen-share");

export const SCREEN_SHARE_COPY = {
	permissionTitle: "Colibri needs permission to record your screen",
	permissionDescription:
		"Turn on Screen Recording for Colibri in System Settings, then share again.",
	openSettings: "Open System Settings",
	notNow: "Not now",
} as const;

const MOBILE_DEVICE = /Android|iPhone|iPad/;

const [pickerOpen, setPickerOpen] = createSignal(false);
const [permissionOpen, setPermissionOpen] = createSignal(false);

const native = createRoot(() => {
	const [supported] = createResource(supportsNativeCapture, {
		initialValue: false,
	});
	return supported;
});

const mobileDevice = () =>
	typeof navigator !== "undefined" && MOBILE_DEVICE.test(navigator.userAgent);

export const screenShareAvailable = () =>
	!mobileDevice() && (native() || supportsDisplayMedia());

const audioSupported = () => native() || supportsDisplayAudio();

const options = (): ScreenShareOptions => {
	const screen = voiceSettings().settings().screen;
	return { ...screen, shareAudio: audioSupported() && screen.shareAudio };
};

export const screenShareSettings = (): ScreenShareSettings => {
	const screen = voiceSettings().settings().screen;
	return audioSupported() ? screen : { ...screen, shareAudio: undefined };
};

export const changeScreenShareSettings = (
	patch: Partial<ScreenShareSettings>,
) => {
	voiceSettings().updateScreen(patch);
	if (patch.resolution === undefined && patch.framerate === undefined) return;
	if (voice.screenSharing()) voice.applyScreenQuality(options());
};

export const screenShareMenu = (): ScreenShareMenuProps => ({
	settings: screenShareSettings(),
	sharing: voice.screenSharing(),
	onSettingsChange: changeScreenShareSettings,
});

export const toggleScreenShare = async () => {
	if (voice.screenSharing()) {
		voice.stopScreenShare();
		return;
	}
	if (native() && !(await nativeCapturePermission(true))) {
		setPermissionOpen(true);
		return;
	}
	setPickerOpen(true);
};

const failed = () => {
	const copy = VOICE_NOTICE_COPY.screenFailed;
	toast(copy.title, { description: copy.description });
};

const shareBrowser = async () => {
	const chosen = options();
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getDisplayMedia(
			displayMediaRequest(chosen) as DisplayMediaStreamOptions,
		);
	} catch (error) {
		if (error instanceof DOMException && error.name === "NotAllowedError") {
			return;
		}
		log.warn("display capture failed", { code: classifyThrown(error).code });
		failed();
		return;
	}
	const video = stream.getVideoTracks()[0];
	if (!video) {
		for (const track of stream.getTracks()) track.stop();
		failed();
		return;
	}
	await voice.shareScreen(
		{
			video,
			audio: chosen.shareAudio ? (stream.getAudioTracks()[0] ?? null) : null,
			release: () => {
				for (const track of stream.getTracks()) track.stop();
			},
		},
		chosen,
	);
};

const shareNative = async (source: NativeCaptureSource) => {
	const chosen = options();
	try {
		const session = await startNativeCapture(
			source.id,
			nativeCaptureQuality(chosen, source.width, source.height),
			chosen.shareAudio,
		);
		const bridge = await createNativeCaptureTrack(session, chosen.shareAudio);
		await voice.shareScreen(
			{
				video: bridge.track,
				audio: bridge.audioTrack,
				release: () => {
					bridge.stop();
					void stopNativeCapture();
				},
			},
			chosen,
		);
	} catch (error) {
		void stopNativeCapture();
		log.warn("native capture failed", { code: classifyThrown(error).code });
		failed();
	}
};

const toPickerSource = async (
	source: NativeCaptureSource,
): Promise<ScreenShareSource> => ({
	id: source.id,
	kind: source.kind,
	name: source.name,
	application: source.application,
	thumbnail: source.hasThumbnail
		? await nativeThumbnailUrl(source.id)
		: undefined,
	aspectRatio: previewAspectRatio(source),
});

export const ScreenShareHost = () => {
	const platform = usePlatform();
	const [sources, setSources] = createSignal<NativeCaptureSource[]>([]);
	const [shown, setShown] = createSignal<ScreenShareSource[]>([]);
	const [loading, setLoading] = createSignal(false);
	const [listFailed, setListFailed] = createSignal(false);
	let listing = 0;

	const list = async () => {
		const run = ++listing;
		setLoading(true);
		setListFailed(false);
		try {
			const next = await listNativeCaptureSources();
			const mapped = await Promise.all(next.map(toPickerSource));
			if (run !== listing) return;
			setSources(next);
			setShown(mapped);
		} catch (error) {
			if (run !== listing) return;
			log.warn("listing capture sources failed", {
				code: classifyThrown(error).code,
			});
			setListFailed(true);
		} finally {
			if (run === listing) setLoading(false);
		}
	};

	createEffect(
		on(pickerOpen, (open) => {
			if (!open) {
				listing += 1;
				setSources([]);
				setShown([]);
				setLoading(false);
				return;
			}
			if (native()) void list();
		}),
	);

	createEffect(
		on(
			() => voice.current(),
			(call) => {
				if (call) return;
				setPickerOpen(false);
				setPermissionOpen(false);
			},
		),
	);

	const share = (picked?: ScreenShareSource) => {
		setPickerOpen(false);
		if (!native()) {
			void shareBrowser();
			return;
		}
		const source = sources().find((entry) => entry.id === picked?.id);
		if (source) void shareNative(source);
	};

	return (
		<>
			<ScreenSharePicker
				open={pickerOpen()}
				onOpenChange={setPickerOpen}
				mode={native() ? "native" : "browser"}
				platform={platform()}
				sources={shown()}
				loading={loading()}
				failed={listFailed()}
				onRetry={() => void list()}
				onOpenPermissionSettings={
					native() ? () => void openScreenRecordingSettings() : undefined
				}
				settings={screenShareSettings()}
				onSettingsChange={changeScreenShareSettings}
				onShare={share}
			/>
			<ConfirmDialog
				open={permissionOpen()}
				onOpenChange={setPermissionOpen}
				title={SCREEN_SHARE_COPY.permissionTitle}
				description={SCREEN_SHARE_COPY.permissionDescription}
				confirmLabel={SCREEN_SHARE_COPY.openSettings}
				cancelLabel={SCREEN_SHARE_COPY.notNow}
				onConfirm={async () => {
					try {
						await openScreenRecordingSettings();
					} catch (error) {
						log.warn("opening privacy settings failed", {
							code: classifyThrown(error).code,
						});
					}
				}}
			/>
		</>
	);
};

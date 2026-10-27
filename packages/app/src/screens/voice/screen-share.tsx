import {
	ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
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
import { withDeadline } from "../../auth/deadline";
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
	CaptureBridgeError,
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
	log.debug("screen share requested", { native: native() });
	if (native() && !(await nativeCapturePermission(true))) {
		log.debug("screen share needs permission");
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

const NATIVE_CAPTURE_DEADLINE_MS = 15_000;

const shareNative = async (source: NativeCaptureSource) => {
	const chosen = options();
	let stage = "start";
	try {
		log.debug("starting the native capture", { kind: source.kind });
		const session = await withDeadline(
			startNativeCapture(
				source.id,
				nativeCaptureQuality(chosen, source.width, source.height),
				chosen.shareAudio,
			),
			NATIVE_CAPTURE_DEADLINE_MS,
			() => new ColibriError({ code: "Timeout" }),
		);
		stage = "bridge";
		log.debug("the native capture started, connecting the bridge");
		const bridge = await withDeadline(
			createNativeCaptureTrack(session, chosen.shareAudio, () => {
				voice.stopScreenShare();
				failed();
			}),
			NATIVE_CAPTURE_DEADLINE_MS,
			() => new ColibriError({ code: "Timeout" }),
		);
		stage = "send";
		log.debug("the capture bridge is ready, sending the screen");
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
		const failure = classifyThrown(error);
		log.warn("native capture failed", {
			code: failure.code,
			stage: error instanceof CaptureBridgeError ? error.stage : stage,
			...(failure.serverMessage ? { reason: failure.serverMessage } : {}),
		});
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
			log.debug("capture sources listed", { count: next.length });
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
		const source = sources().find((entry) => entry.id === picked?.id);
		setPickerOpen(false);
		if (!native()) {
			void shareBrowser();
			return;
		}
		if (!source) {
			log.warn("the picked capture source is gone");
			failed();
			return;
		}
		void shareNative(source);
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

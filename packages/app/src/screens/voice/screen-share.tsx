import {
	ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import {
	ConfirmDialog,
	type ScreenShareAudioApp,
	type ScreenShareMenuProps,
	ScreenSharePicker,
	type ScreenShareSettings,
	type ScreenShareSource,
	type ScreenShareSurface,
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
	isLinuxApp,
	type ScreenShareOptions,
	supportsDisplayAudio,
	supportsDisplayMedia,
} from "../../data/screen-share";
import { voice } from "../../data/voice";
import { voiceSettings } from "../../data/voice-settings";
import {
	CaptureBridgeError,
	createNativeCaptureTrack,
	listNativeAudioApps,
	listNativeCaptureSources,
	type NativeCapturePicker,
	type NativeCaptureSource,
	type NativeSourceKind,
	nativeCapturePermission,
	nativeCapturePicker,
	nativeCaptureQuality,
	nativeThumbnailUrl,
	openScreenRecordingSettings,
	previewAspectRatio,
	startNativeCapture,
	stopNativeCapture,
	supportsNativeCapture,
} from "../../native/screen-capture";
import { usePlatform } from "../../screen/platform";
import { isNativeShell } from "../../shell/desktop/window-chrome";

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
const [surface, setSurface] = createSignal<ScreenShareSurface>("screen");
const [picker, setPicker] = createSignal<NativeCapturePicker>();

const CANCELLED_CAPTURE = new Set(["NotAllowedError", "AbortError"]);

const native = createRoot(() => {
	const [supported] = createResource(supportsNativeCapture, {
		initialValue: false,
	});
	return supported;
});

const mobileDevice = () =>
	typeof navigator !== "undefined" && MOBILE_DEVICE.test(navigator.userAgent);

const linuxApp = () =>
	isLinuxApp(
		typeof navigator === "undefined" ? undefined : navigator.userAgent,
		isNativeShell(),
	);

export const screenShareAvailable = () =>
	!mobileDevice() && (native() || (supportsDisplayMedia() && !linuxApp()));

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

const portal = () => native() && picker()?.kind === "portal";

const loadPicker = async () => {
	try {
		setPicker(await nativeCapturePicker());
	} catch (error) {
		log.warn("reading the capture picker failed", {
			code: classifyThrown(error).code,
		});
		setPicker({ kind: "sources" });
	}
};

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
	if (native()) await loadPicker();
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
		if (error instanceof DOMException && CANCELLED_CAPTURE.has(error.name)) {
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

type NativeShareRequest = {
	systemDialog: boolean;
	audioApps?: string[];
};

const shareNative = async (
	source: NativeCaptureSource,
	request: NativeShareRequest = { systemDialog: false },
) => {
	const chosen = options();
	let stage = "start";
	try {
		log.debug("starting the native capture", {
			kind: source.kind,
			systemDialog: request.systemDialog,
		});
		const starting = startNativeCapture(
			source.id,
			nativeCaptureQuality(chosen, source.width, source.height),
			chosen.shareAudio,
			request.audioApps,
		);
		const session = request.systemDialog
			? await starting
			: await withDeadline(
					starting,
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
		if (failure.code === "NativeCancelled") {
			log.debug("the system dialog was cancelled");
			return;
		}
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

const SURFACE_KIND: Record<ScreenShareSurface, NativeSourceKind> = {
	screen: "display",
	window: "window",
};

export const ScreenShareHost = () => {
	const platform = usePlatform();
	const [audioApps, setAudioApps] = createSignal<ScreenShareAudioApp[]>();
	const [audioApp, setAudioApp] = createSignal<string>();
	const [excludedApps, setExcludedApps] = createSignal<string[]>();
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
				setAudioApps(undefined);
				setAudioApp(undefined);
				setExcludedApps(undefined);
				return;
			}
			if (native()) void list();
		}),
	);

	let audioListing = 0;
	createEffect(
		on(
			() =>
				[
					pickerOpen(),
					native(),
					portal(),
					screenShareSettings().shareAudio,
				] as const,
			([open, nativeCapture, systemDialog, shareAudio]) => {
				const run = ++audioListing;
				if (!open || !nativeCapture || !shareAudio) return;
				const windowSource = systemDialog
					? sources().find((entry) => entry.kind === "window")
					: undefined;
				void listNativeAudioApps(windowSource?.id)
					.then((apps) => {
						if (run !== audioListing) return;
						setAudioApps(
							apps.map(({ id, name, router }) => ({ id, name, router })),
						);
						const preselected = apps.find((app) => app.preselected);
						if (preselected && audioApp() === undefined)
							setAudioApp(preselected.id);
						if (excludedApps() === undefined)
							setExcludedApps(
								apps.filter((app) => app.router).map((app) => app.id),
							);
					})
					.catch((error) => {
						if (run !== audioListing) return;
						log.warn("listing audio apps failed", {
							code: classifyThrown(error).code,
						});
						setAudioApps([]);
					});
			},
		),
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

	const screenAudioApps = (): string[] | undefined => {
		const apps = audioApps();
		const excluded = excludedApps() ?? [];
		if (!apps?.some((app) => app.router) || excluded.length === 0)
			return undefined;
		return apps
			.filter((app) => !excluded.includes(app.id))
			.map((app) => app.id);
	};

	const share = (picked?: ScreenShareSource) => {
		const systemDialog = portal();
		const chosenSurface = surface();
		const source = systemDialog
			? sources().find((entry) => entry.kind === SURFACE_KIND[chosenSurface])
			: sources().find((entry) => entry.id === picked?.id);
		const chosenApp = audioApp();
		const wholeScreen = systemDialog
			? chosenSurface === "screen"
			: source?.kind === "display";
		const screenApps = wholeScreen ? screenAudioApps() : undefined;
		setPickerOpen(false);
		if (!native()) {
			void shareBrowser();
			return;
		}
		if (systemDialog && source) {
			void shareNative(source, {
				systemDialog: true,
				audioApps:
					chosenSurface === "window"
						? chosenApp
							? [chosenApp]
							: []
						: screenApps,
			});
			return;
		}
		if (!source) {
			log.warn("the picked capture source is gone");
			failed();
			return;
		}
		void shareNative(source, { systemDialog: false, audioApps: screenApps });
	};

	return (
		<>
			<ScreenSharePicker
				open={pickerOpen()}
				onOpenChange={setPickerOpen}
				mode={native() ? (portal() ? "system" : "native") : "browser"}
				surface={surface()}
				onSurfaceChange={setSurface}
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
				audioApps={audioApps()}
				audioApp={audioApp()}
				onAudioAppChange={setAudioApp}
				excludedAudioApps={excludedApps()}
				onExcludedAudioAppsChange={setExcludedApps}
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

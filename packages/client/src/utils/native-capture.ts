import { isTauriRuntime } from "../notifications/environment";
import { createNativeAudioBridge } from "./native-capture-audio";
import { workerSource } from "./native-capture-worker";
import type { ScreenShareQuality } from "./screen-share";
import { screenMaxBitrate } from "./screen-share";

export type NativeSourceKind = "display" | "window" | "application";

export interface NativeCaptureSource {
	id: string;
	kind: NativeSourceKind;
	name: string;
	application: string | null;
	width: number;
	height: number;
	hasThumbnail: boolean;
}

export interface NativeCaptureSession {
	url: string;
	token: string;
}

export interface NativeCaptureQuality {
	width: number;
	height: number;
	framerate: number;
	maxBitrate: number;
}

const RESOLUTION_HEIGHTS: Record<string, number | undefined> = {
	"720": 720,
	"1080": 1080,
	"1440": 1440,
	source: undefined,
};

export const nativeCaptureQuality = (
	quality: ScreenShareQuality,
	sourceWidth: number,
	sourceHeight: number,
): NativeCaptureQuality => {
	const safeWidth = Math.max(2, Math.round(sourceWidth) || 1920);
	const safeHeight = Math.max(2, Math.round(sourceHeight) || 1080);
	const target = RESOLUTION_HEIGHTS[quality.resolution];

	const scale = target === undefined ? 1 : Math.min(1, target / safeHeight);
	const even = (value: number): number =>
		Math.max(2, Math.round(value * scale) & ~1);

	return {
		width: even(safeWidth),
		height: even(safeHeight),
		framerate: quality.framerate,
		maxBitrate: screenMaxBitrate(quality),
	};
};

const MIN_PREVIEW_RATIO = 0.5;
const MAX_PREVIEW_RATIO = 3.5;

export const previewAspectRatio = (source: {
	width: number;
	height: number;
}): string => {
	const wide = Math.max(1, source.width);
	const high = Math.max(1, source.height);
	return String(
		Math.min(MAX_PREVIEW_RATIO, Math.max(MIN_PREVIEW_RATIO, wide / high)),
	);
};

export const supportsNativeCapture = async (): Promise<boolean> => {
	if (!isTauriRuntime()) return false;
	if (typeof VideoDecoder === "undefined") return false;
	if (typeof Worker === "undefined") return false;

	try {
		const { invoke } = await import("@tauri-apps/api/core");
		return await invoke<boolean>("screen_capture_supported");
	} catch {
		return false;
	}
};

export const nativeCapturePermission = async (
	request: boolean,
): Promise<boolean> => {
	if (!isTauriRuntime()) return false;
	try {
		const { invoke } = await import("@tauri-apps/api/core");
		return await invoke<boolean>("screen_capture_permission", { request });
	} catch {
		return false;
	}
};

export const openScreenRecordingSettings = async (): Promise<void> => {
	const { invoke } = await import("@tauri-apps/api/core");
	await invoke("screen_capture_open_settings");
};

export const promptForScreenRecording = async (): Promise<boolean> => {
	if (await nativeCapturePermission(true)) return true;

	const { ask } = await import("@tauri-apps/plugin-dialog");
	const openSettings = await ask(
		"Colibri needs permission to record the screen before it can share one. You can turn it on in System Settings under Privacy & Security.",
		{
			title: "Screen Recording is off",
			kind: "warning",
			okLabel: "Open System Settings",
			cancelLabel: "Not Now",
		},
	);

	if (openSettings) await openScreenRecordingSettings();
	return false;
};

export const listNativeCaptureSources = async (): Promise<
	NativeCaptureSource[]
> => {
	const { invoke } = await import("@tauri-apps/api/core");
	return await invoke<NativeCaptureSource[]>("screen_capture_list_sources");
};

export const startNativeCapture = async (
	sourceId: string,
	quality: NativeCaptureQuality,
	captureAudio: boolean,
): Promise<NativeCaptureSession> => {
	const { invoke } = await import("@tauri-apps/api/core");
	return await invoke<NativeCaptureSession>("screen_capture_start", {
		sourceId,
		quality,
		captureAudio,
	});
};

export const stopNativeCapture = async (): Promise<void> => {
	if (!isTauriRuntime()) return;
	try {
		const { invoke } = await import("@tauri-apps/api/core");
		await invoke("screen_capture_stop");
	} catch {
		return;
	}
};

export const nativeThumbnailUrl = async (id: string): Promise<string> => {
	const { convertFileSrc } = await import("@tauri-apps/api/core");
	return convertFileSrc(id, "capture-thumb");
};

export interface NativeCaptureTrack {
	track: MediaStreamTrack;
	audioTrack: MediaStreamTrack | null;
	stop: () => void;
}

interface TrackSink {
	track: MediaStreamTrack;
	writable: WritableStream<VideoFrame>;
}

const createMainThreadSink = (): TrackSink | null => {
	const generator = (
		globalThis as unknown as {
			MediaStreamTrackGenerator?: new (options: { kind: string }) => unknown;
		}
	).MediaStreamTrackGenerator;

	if (typeof generator !== "function") return null;

	const created = new generator({ kind: "video" }) as MediaStreamTrack & {
		writable: WritableStream<VideoFrame>;
	};

	return { track: created, writable: created.writable };
};

export interface CaptureCleanupTargets {
	worker: Pick<Worker, "terminate">;
	revoke: () => void;
	audio: { stop: () => void } | null;
	writer: Pick<WritableStreamDefaultWriter<VideoFrame>, "close"> | null;
}

export const createCaptureCleanup = (
	targets: CaptureCleanupTargets,
): (() => void) => {
	let done = false;

	return () => {
		if (done) return;
		done = true;

		targets.worker.terminate();
		targets.revoke();
		targets.audio?.stop();
		try {
			void targets.writer?.close().catch(() => {});
		} catch {
			return;
		}
	};
};

export const createNativeCaptureTrack = async (
	session: NativeCaptureSession,
	withAudio: boolean,
): Promise<NativeCaptureTrack> => {
	const audio = withAudio ? await createNativeAudioBridge() : null;
	const sink = createMainThreadSink();

	return await new Promise<NativeCaptureTrack>((resolve, reject) => {
		const blob = new Blob([workerSource()], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		const worker = new Worker(url, { type: "module" });
		const writer = sink?.writable.getWriter() ?? null;

		let settled = false;

		const cleanup = createCaptureCleanup({
			worker,
			revoke: () => URL.revokeObjectURL(url),
			audio,
			writer,
		});

		const settle = (track: MediaStreamTrack): void => {
			settled = true;
			resolve({
				track,
				audioTrack: audio?.track ?? null,
				stop: () => {
					worker.postMessage({ type: "stop" });
					cleanup();
				},
			});
		};

		worker.onmessage = (event: MessageEvent) => {
			const data = event.data as
				| { type: "ready" }
				| { type: "track"; track: MediaStreamTrack }
				| { type: "frame"; frame: VideoFrame }
				| { type: "audio"; frames: number; planes: Float32Array[] }
				| { type: "error"; message: string }
				| { type: "ended" };

			if (data.type === "audio") {
				audio?.push({ frames: data.frames, planes: data.planes });
				return;
			}

			if (data.type === "frame") {
				if (!writer) {
					data.frame.close();
					return;
				}
				writer
					.write(data.frame)
					.catch(() => {})
					.finally(() => data.frame.close());
				return;
			}

			if (data.type === "ready" && sink) {
				settle(sink.track);
				return;
			}

			if (data.type === "track") {
				settle(data.track);
				return;
			}

			if (data.type === "error" && !settled) {
				settled = true;
				cleanup();
				reject(new Error(data.message));
				return;
			}

			if (data.type === "ended") cleanup();
		};

		worker.onerror = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new Error("the capture bridge failed to start"));
		};

		worker.postMessage({
			url: session.url,
			token: session.token,
			mode: sink ? "main" : "worker",
		});
	});
};

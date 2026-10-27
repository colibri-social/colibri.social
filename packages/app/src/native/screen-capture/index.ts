import { classifyThrown, createLogger } from "@colibri-social/lib";
import { classifyNativeError, isNativeShell } from "../../auth/native";
import {
	resolutionHeight,
	type ScreenShareQuality,
	screenMaxBitrate,
} from "../../data/screen-share";
import { createNativeAudioBridge } from "./audio";
import { workerSource } from "./worker";

export type NativeSourceKind = "display" | "window" | "application";

export type NativeCaptureSource = {
	id: string;
	kind: NativeSourceKind;
	name: string;
	application: string | null;
	width: number;
	height: number;
	hasThumbnail: boolean;
};

export type NativeCaptureSession = {
	url: string;
	token: string;
};

export type NativeCaptureQuality = {
	width: number;
	height: number;
	framerate: number;
	maxBitrate: number;
};

export type NativeCaptureTrack = {
	track: MediaStreamTrack;
	audioTrack: MediaStreamTrack | null;
	stop: () => void;
};

const log = createLogger("screen-capture");

const invoke = async <T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T> => {
	const core = await import("@tauri-apps/api/core");
	try {
		return await core.invoke<T>(command, args);
	} catch (error) {
		throw classifyNativeError(error, command);
	}
};

export const nativeCaptureQuality = (
	quality: ScreenShareQuality,
	sourceWidth: number,
	sourceHeight: number,
): NativeCaptureQuality => {
	const safeWidth = Math.max(2, Math.round(sourceWidth) || 1920);
	const safeHeight = Math.max(2, Math.round(sourceHeight) || 1080);
	const target = resolutionHeight(quality.resolution);
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
}): number => {
	const wide = Math.max(1, source.width);
	const high = Math.max(1, source.height);
	return Math.min(MAX_PREVIEW_RATIO, Math.max(MIN_PREVIEW_RATIO, wide / high));
};

export const supportsNativeCapture = async (): Promise<boolean> => {
	if (!isNativeShell()) return false;
	if (typeof VideoDecoder === "undefined") return false;
	if (typeof Worker === "undefined") return false;
	try {
		return await invoke<boolean>("screen_capture_supported");
	} catch (error) {
		log.debug("capture support check failed", {
			code: classifyThrown(error).code,
		});
		return false;
	}
};

export const nativeCapturePermission = async (
	request: boolean,
): Promise<boolean> => {
	if (!isNativeShell()) return false;
	try {
		return await invoke<boolean>("screen_capture_permission", { request });
	} catch (error) {
		log.warn("capture permission check failed", {
			code: classifyThrown(error).code,
		});
		return false;
	}
};

export const openScreenRecordingSettings = (): Promise<void> =>
	invoke<void>("screen_capture_open_settings");

export const listNativeCaptureSources = (): Promise<NativeCaptureSource[]> =>
	invoke<NativeCaptureSource[]>("screen_capture_list_sources");

export const startNativeCapture = (
	sourceId: string,
	quality: NativeCaptureQuality,
	captureAudio: boolean,
): Promise<NativeCaptureSession> =>
	invoke<NativeCaptureSession>("screen_capture_start", {
		sourceId,
		quality,
		captureAudio,
	});

export const stopNativeCapture = async (): Promise<void> => {
	if (!isNativeShell()) return;
	try {
		await invoke<void>("screen_capture_stop");
	} catch (error) {
		log.debug("capture stop failed", { code: classifyThrown(error).code });
	}
};

export const nativeThumbnailUrl = async (id: string): Promise<string> => {
	const { convertFileSrc } = await import("@tauri-apps/api/core");
	return convertFileSrc(id, "capture-thumb");
};

type TrackSink = {
	track: MediaStreamTrack;
	writable: WritableStream<VideoFrame>;
};

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

export type CaptureCleanupTargets = {
	worker: Pick<Worker, "terminate">;
	revoke: () => void;
	audio: { stop: () => void } | null;
	writer: Pick<WritableStreamDefaultWriter<VideoFrame>, "close"> | null;
};

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

export type CaptureFailureStage = "bridge" | "connection" | "decode";

export class CaptureBridgeError extends Error {
	constructor(
		readonly stage: CaptureFailureStage,
		message: string,
	) {
		super(message);
		this.name = "CaptureBridgeError";
	}
}

type WorkerMessage =
	| { type: "ready" }
	| { type: "track"; track: MediaStreamTrack }
	| { type: "frame"; frame: VideoFrame }
	| { type: "audio"; frames: number; planes: Float32Array[] }
	| { type: "error"; stage: CaptureFailureStage; message: string }
	| { type: "ended" };

export const createNativeCaptureTrack = async (
	session: NativeCaptureSession,
	withAudio: boolean,
	onFailure?: (stage: CaptureFailureStage) => void,
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

		const settle = (track: MediaStreamTrack) => {
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

		worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
			const data = event.data;
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
			if (data.type === "error") {
				cleanup();
				if (!settled) {
					settled = true;
					reject(new CaptureBridgeError(data.stage, data.message));
					return;
				}
				log.warn("the screen capture stopped", { stage: data.stage });
				onFailure?.(data.stage);
				return;
			}
			if (data.type === "ended") cleanup();
		};

		worker.onerror = () => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(
				new CaptureBridgeError("bridge", "the capture bridge failed to start"),
			);
		};

		worker.postMessage({
			url: session.url,
			token: session.token,
			mode: sink ? "main" : "worker",
		});
	});
};

import {
	ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";

const log = createLogger("settings/devices");

export type MediaDeviceOption = { id: string; label: string };

export type MediaDeviceLists = {
	microphones: MediaDeviceOption[];
	speakers: MediaDeviceOption[];
	cameras: MediaDeviceOption[];
};

const EMPTY: MediaDeviceLists = { microphones: [], speakers: [], cameras: [] };

const FALLBACK_LABELS: Record<MediaDeviceKind, string> = {
	audioinput: "Microphone",
	audiooutput: "Speaker",
	videoinput: "Camera",
};

export const toDeviceLists = (
	devices: readonly Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">[],
): MediaDeviceLists => {
	const lists: MediaDeviceLists = {
		microphones: [],
		speakers: [],
		cameras: [],
	};
	const target: Record<MediaDeviceKind, MediaDeviceOption[]> = {
		audioinput: lists.microphones,
		audiooutput: lists.speakers,
		videoinput: lists.cameras,
	};
	for (const device of devices) {
		if (!device.deviceId) continue;
		const list = target[device.kind];
		if (list.some((entry) => entry.id === device.deviceId)) continue;
		list.push({
			id: device.deviceId,
			label:
				device.label || `${FALLBACK_LABELS[device.kind]} ${list.length + 1}`,
		});
	}
	return lists;
};

export const canPickSpeaker = () =>
	typeof HTMLMediaElement !== "undefined" &&
	"setSinkId" in HTMLMediaElement.prototype;

const mediaDevices = () =>
	typeof navigator === "undefined" ? undefined : navigator.mediaDevices;

export const listMediaDevices = async (): Promise<MediaDeviceLists> => {
	const devices = mediaDevices();
	if (!devices?.enumerateDevices) return EMPTY;
	try {
		return toDeviceLists(await devices.enumerateDevices());
	} catch (error) {
		log.warn("listing devices failed", { code: classifyThrown(error).code });
		return EMPTY;
	}
};

export const watchMediaDevices = (onChange: () => void) => {
	const devices = mediaDevices();
	if (!devices?.addEventListener) return () => {};
	devices.addEventListener("devicechange", onChange);
	return () => devices.removeEventListener("devicechange", onChange);
};

const stopStream = (stream: MediaStream) => {
	for (const track of stream.getTracks()) track.stop();
};

export const microphoneConstraints = (input: {
	noiseSuppression: boolean;
}): MediaTrackConstraints => ({
	noiseSuppression: input.noiseSuppression,
	echoCancellation: true,
	autoGainControl: true,
});

const isMissingDevice = (error: unknown) => {
	const name = (error as { name?: unknown } | null)?.name;
	return name === "OverconstrainedError" || name === "NotFoundError";
};

type GetUserMedia = (
	constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

type MediaDeviceKindName = "microphone" | "camera";

const STREAM_KEY: Record<MediaDeviceKindName, "audio" | "video"> = {
	microphone: "audio",
	camera: "video",
};

export const openMediaDevice = async (
	getUserMedia: GetUserMedia,
	kind: MediaDeviceKindName,
	constraints: MediaTrackConstraints,
	deviceId: string | undefined,
): Promise<MediaStream> => {
	const key = STREAM_KEY[kind];
	if (!deviceId) return getUserMedia({ [key]: constraints });
	try {
		return await getUserMedia({
			[key]: { ...constraints, deviceId: { exact: deviceId } },
		});
	} catch (error) {
		if (!isMissingDevice(error)) throw error;
		log.info(`saved ${kind} is missing, using the system default`, {
			code: classifyThrown(error).code,
		});
		return getUserMedia({ [key]: constraints });
	}
};

export const openMicrophone = (
	getUserMedia: GetUserMedia,
	constraints: MediaTrackConstraints,
	microphone: string | undefined,
): Promise<MediaStream> =>
	openMediaDevice(getUserMedia, "microphone", constraints, microphone);

export const CAMERA_FRAME: MediaTrackConstraints = {
	width: { ideal: 1280 },
	height: { ideal: 720 },
	aspectRatio: { ideal: 16 / 9 },
};

export const openCamera = (
	getUserMedia: GetUserMedia,
	camera: string | undefined,
): Promise<MediaStream> =>
	openMediaDevice(getUserMedia, "camera", CAMERA_FRAME, camera);

export const levelOf = (samples: Uint8Array, gain = 1) => {
	if (samples.length === 0) return 0;
	let sum = 0;
	for (const sample of samples) {
		const centered = (sample - 128) / 128;
		sum += centered * centered;
	}
	return Math.min(1, Math.sqrt(sum / samples.length) * 4 * gain);
};

export type MicTest = { stop: () => void };

export const startMicTest = async (input: {
	microphone?: string;
	noiseSuppression: boolean;
	gain: () => number;
	onLevel: (level: number) => void;
}): Promise<MicTest> => {
	const devices = mediaDevices();
	if (!devices?.getUserMedia)
		throw new ColibriError({ code: "DeviceUnavailable" });
	const stream = await openMicrophone(
		(constraints) => devices.getUserMedia(constraints),
		microphoneConstraints(input),
		input.microphone,
	);
	const context = new AudioContext({ latencyHint: "interactive" });
	const analyser = context.createAnalyser();
	analyser.fftSize = 1024;
	context.createMediaStreamSource(stream).connect(analyser);
	const samples = new Uint8Array(analyser.fftSize);
	let frame = 0;
	const tick = () => {
		analyser.getByteTimeDomainData(samples);
		input.onLevel(levelOf(samples, input.gain()));
		frame = requestAnimationFrame(tick);
	};
	frame = requestAnimationFrame(tick);
	return {
		stop: () => {
			cancelAnimationFrame(frame);
			stopStream(stream);
			void context.close().catch(() => undefined);
			input.onLevel(0);
		},
	};
};

export const startCameraPreview = async (camera?: string) => {
	const devices = mediaDevices();
	if (!devices?.getUserMedia)
		throw new ColibriError({ code: "DeviceUnavailable" });
	return devices.getUserMedia({
		video: camera
			? { ...CAMERA_FRAME, deviceId: { exact: camera } }
			: CAMERA_FRAME,
	});
};

export const stopMediaStream = stopStream;

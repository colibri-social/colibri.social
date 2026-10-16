import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	CameraPreviewDialog,
	type CameraPreviewState,
} from "@colibri-social/ui";
import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { describeError } from "../../data/error-copy";
import { startCameraPreview, stopMediaStream } from "../../data/media-devices";
import { voice } from "../../data/voice";
import { voiceSettings } from "../../data/voice-settings";

const log = createLogger("voice/camera-preview");

const [previewOpen, setPreviewOpen] = createSignal(false);

export const openCameraPreview = () => setPreviewOpen(true);

export const closeCameraPreview = () => setPreviewOpen(false);

export const cameraPreviewOpen = previewOpen;

export const CameraPreviewHost = () => {
	const [stream, setStream] = createSignal<MediaStream>();
	const [state, setState] = createSignal<CameraPreviewState>("loading");
	const [error, setError] = createSignal<string>();
	let run = 0;

	const stop = () => {
		run += 1;
		const current = stream();
		if (current) stopMediaStream(current);
		setStream(undefined);
	};

	const start = async () => {
		stop();
		const attempt = run;
		setState("loading");
		try {
			const next = await startCameraPreview(voiceSettings().settings().camera);
			if (attempt !== run) {
				stopMediaStream(next);
				return;
			}
			setStream(next);
			setState("ready");
		} catch (thrown) {
			if (attempt !== run) return;
			const failure = classifyThrown(thrown, { method: "voice.cameraPreview" });
			log.warn("camera preview failed", { code: failure.code });
			const copy = describeError(failure);
			setError(copy.description ?? copy.title);
			setState("error");
		}
	};

	createEffect(
		on(previewOpen, (open) => {
			if (open) void start();
			else stop();
		}),
	);
	onCleanup(stop);

	return (
		<CameraPreviewDialog
			open={previewOpen()}
			onOpenChange={setPreviewOpen}
			stream={stream()}
			state={state()}
			error={error()}
			cameraOn={voice.camera()}
			onTurnOnCamera={
				voice.current()
					? () => {
							closeCameraPreview();
							if (!voice.camera()) voice.toggleCamera();
						}
					: undefined
			}
		/>
	);
};

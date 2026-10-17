import {
	type CameraPreviewState,
	type MicTestState,
	VoiceVideoSettings,
} from "@colibri-social/ui";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
	canPickSpeaker,
	listMediaDevices,
	type MediaDeviceLists,
	type MicTest,
	startCameraPreview,
	startMicTest,
	stopMediaStream,
	watchMediaDevices,
} from "../../../data/media-devices";
import { useData } from "../../../data/store";
import { voiceSettings } from "../../../data/voice-settings";
import type { Platform } from "../../../screen/platform";
import { reportDeviceError } from "./device-error";

const hasMediaDevices = () =>
	typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export default function VoiceVideoPage(props: { platform: Platform }) {
	const data = useData();
	const voice = voiceSettings();
	const media = hasMediaDevices();
	const [devices, setDevices] = createSignal<MediaDeviceLists>({
		microphones: [],
		speakers: [],
		cameras: [],
	});
	const refresh = () => void listMediaDevices().then(setDevices);

	const [micTest, setMicTest] = createSignal<MicTestState>("idle");
	const [micLevel, setMicLevel] = createSignal(0);
	let test: MicTest | undefined;
	let testRun = 0;

	const stopTest = () => {
		testRun += 1;
		test?.stop();
		test = undefined;
		setMicTest("idle");
		setMicLevel(0);
	};

	const startTest = async () => {
		const run = ++testRun;
		setMicTest("starting");
		try {
			const started = await startMicTest({
				microphone: voice.settings().microphone,
				noiseSuppression: voice.settings().noiseSuppression,
				gain: () => voice.settings().inputVolume / 100,
				onLevel: setMicLevel,
			});
			if (run !== testRun) {
				started.stop();
				return;
			}
			test = started;
			setMicTest("running");
			refresh();
		} catch (error) {
			if (run !== testRun) return;
			setMicTest("idle");
			reportDeviceError(
				error,
				"settings.micTest",
				"Couldn't start the microphone test",
			);
		}
	};

	const restartTest = () => {
		if (micTest() === "idle") return;
		stopTest();
		void startTest();
	};

	const [stream, setStream] = createSignal<MediaStream>();
	const [cameraState, setCameraState] =
		createSignal<CameraPreviewState>("idle");
	const [cameraError, setCameraError] = createSignal<string>();
	let cameraRun = 0;

	const releaseCamera = () => {
		cameraRun += 1;
		const current = stream();
		if (current) stopMediaStream(current);
		setStream(undefined);
	};

	const stopCamera = () => {
		releaseCamera();
		setCameraState("idle");
	};

	const startCamera = async () => {
		releaseCamera();
		const run = cameraRun;
		setCameraState("loading");
		try {
			const next = await startCameraPreview(voice.settings().camera);
			if (run !== cameraRun) {
				stopMediaStream(next);
				return;
			}
			setStream(next);
			setCameraState("ready");
			refresh();
		} catch (error) {
			if (run !== cameraRun) return;
			const copy = reportDeviceError(
				error,
				"settings.cameraPreview",
				"Couldn't start your camera",
			);
			setCameraError(copy.description ?? copy.title);
			setCameraState("error");
		}
	};

	onMount(refresh);
	onCleanup(watchMediaDevices(refresh));
	onCleanup(() => {
		stopTest();
		stopCamera();
	});

	const voiceView = () => data.preferences.client().voiceView;
	const setVoiceView = (patch: Partial<ReturnType<typeof voiceView>>) =>
		void data.preferences.setClient({ voiceView: patch });

	return (
		<VoiceVideoSettings
			platform={props.platform}
			microphones={devices().microphones}
			microphone={voice.settings().microphone}
			onMicrophoneChange={(id) => {
				voice.update({ microphone: id });
				restartTest();
			}}
			inputVolume={voice.settings().inputVolume}
			onInputVolumeChange={(volume) => voice.update({ inputVolume: volume })}
			micTest={micTest()}
			micLevel={micLevel()}
			onMicTestToggle={() => {
				if (micTest() === "idle") void startTest();
				else stopTest();
			}}
			speakers={canPickSpeaker() ? devices().speakers : undefined}
			speaker={voice.settings().speaker}
			onSpeakerChange={(id) => voice.update({ speaker: id })}
			outputVolume={voice.settings().outputVolume}
			onOutputVolumeChange={(volume) => voice.update({ outputVolume: volume })}
			noiseSuppression={voice.settings().noiseSuppression}
			onNoiseSuppressionChange={(enabled) => {
				voice.update({ noiseSuppression: enabled });
				restartTest();
			}}
			voiceGate={voice.settings().voiceGate}
			onVoiceGateChange={(enabled) => voice.update({ voiceGate: enabled })}
			confirmJoin={voiceView().confirmJoin}
			onConfirmJoinChange={(enabled) => setVoiceView({ confirmJoin: enabled })}
			showNonVideoParticipants={voiceView().showNonVideoParticipants}
			onShowNonVideoParticipantsChange={(enabled) =>
				setVoiceView({ showNonVideoParticipants: enabled })
			}
			showOwnCamera={voiceView().showOwnCamera}
			onShowOwnCameraChange={(enabled) =>
				setVoiceView({ showOwnCamera: enabled })
			}
			cameras={media ? devices().cameras : undefined}
			camera={voice.settings().camera}
			onCameraChange={(id) => {
				voice.update({ camera: id });
				if (cameraState() !== "idle") void startCamera();
			}}
			cameraPreviewState={cameraState()}
			onCameraPreviewToggle={() => {
				const state = cameraState();
				if (state === "ready" || state === "loading") stopCamera();
				else void startCamera();
			}}
			cameraError={cameraError()}
			cameraPreview={
				<video
					data-camera-video=""
					class="size-full -scale-x-100 object-cover"
					autoplay
					muted
					playsinline
					ref={(element) => {
						createEffect(() => {
							element.srcObject = stream() ?? null;
						});
					}}
				/>
			}
		/>
	);
}

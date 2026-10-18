import { Show } from "solid-js";
import { Button } from "../Button/Button";
import { Modal, ModalContent } from "../Modal/Modal";
import type { CameraPreviewState } from "../SettingsPages/VoiceVideoSettings";
import { Spinner } from "../Spinner/Spinner";
import { VideoSurface } from "./shared";

export type CameraPreviewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	stream?: MediaStream;
	state: CameraPreviewState;
	error?: string;
	cameraOn?: boolean;
	onTurnOnCamera?: () => void;
};

export const CAMERA_PREVIEW_COPY = {
	title: "Camera preview",
	description: "Only you can see this preview.",
	turnOn: "Turn on camera",
	alreadyOn: "Your camera is on",
	error: "Your camera didn't start.",
} as const;

export const CameraPreviewDialog = (props: CameraPreviewDialogProps) => (
	<Modal open={props.open} onOpenChange={props.onOpenChange}>
		<ModalContent
			title={CAMERA_PREVIEW_COPY.title}
			description={CAMERA_PREVIEW_COPY.description}
			footer={
				<Show when={props.onTurnOnCamera}>
					{(turnOn) => (
						<Button
							disabled={props.cameraOn || props.state !== "ready"}
							onClick={() => turnOn()()}
						>
							{props.cameraOn
								? CAMERA_PREVIEW_COPY.alreadyOn
								: CAMERA_PREVIEW_COPY.turnOn}
						</Button>
					)}
				</Show>
			}
		>
			<div
				data-camera-preview={props.state}
				class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-surface bg-black"
			>
				<Show when={props.state === "ready" && props.stream}>
					{(stream) => <VideoSurface stream={stream()} mirror />}
				</Show>
				<Show when={props.state === "loading"}>
					<Spinner label="Starting your camera" />
				</Show>
				<Show when={props.state === "error"}>
					<p class="m-0 px-4 text-center text-sm text-pretty text-white">
						{props.error ?? CAMERA_PREVIEW_COPY.error}
					</p>
				</Show>
			</div>
		</ModalContent>
	</Modal>
);

import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import {
	ConnectionState,
	useVoiceChatContext,
} from "../../../contexts/VoiceChat";
import { classifyThrown } from "../../../errors/classify";
import { describeError } from "../../../errors/copy";
import { createLogger } from "../../../utils/logger";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../ui/Select";
import { SettingsPage } from "../common/SettingsModal";
import type { DeviceOption } from "./shared";

const log = createLogger("settings/video");

export const VideoPage: Component = () => {
	const userPreferences = useUserPreferences();
	const [voiceChat] = useVoiceChatContext();
	const [cameraStream, setCameraStream] = createSignal<MediaStream | null>(
		null,
	);
	const [cameras, setCameras] = createSignal<Array<DeviceOption>>([]);
	const [previouslyEnabled, setPreviouslyEnabled] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	let previewEl!: HTMLVideoElement;

	onMount(() => {
		void (async () => {
			try {
				const probe = await navigator.mediaDevices.getUserMedia({
					video: true,
				});

				probe.getTracks().forEach((t) => {
					t.stop();
				});

				const devices = (await navigator.mediaDevices.enumerateDevices())
					.filter((d) => d.kind === "videoinput")
					.map((d) => ({ name: d.label, id: d.deviceId }));

				setCameras(devices);
			} catch (e) {
				log.warn("listing cameras failed", {
					code: classifyThrown(e).code,
				});
				const copy = describeError(e);
				setError(copy.description ?? copy.title);
			}
		})();
	});

	createEffect(() => {
		const deviceId =
			userPreferences.preferences().voice.camera.preferredDeviceId;

		let stream: MediaStream | null = null;
		let aborted = false;

		(async () => {
			if (
				voiceChat.connection.state === ConnectionState.Connected &&
				voiceChat.states.camEnabled
			) {
				voiceChat.states.camEnabled = false;
				setPreviouslyEnabled(true);
			}

			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 1920 },
						height: { ideal: 1080 },
						aspectRatio: { ideal: 16 / 9 },
						deviceId: deviceId || undefined,
					},
				});

				if (aborted) {
					stream.getTracks().forEach((t) => {
						t.stop();
					});
					return;
				}

				setCameraStream(stream);
				previewEl.pause();
				previewEl.srcObject = stream;
				previewEl.play().catch((e) => {
					if (e.name === "AbortError") return;
					log.error("playing the preview failed", { error: e });
					setError(e instanceof Error ? e.message : e);
				});

				setError(null);
			} catch (e) {
				log.error("opening the camera failed", { error: e });
				const copy = describeError(e);
				setError(copy.description ?? copy.title);
			}
		})();

		onCleanup(() => {
			aborted = true;
			stream?.getTracks().forEach((t) => {
				t.stop();
			});
			setCameraStream(null);
		});
	});

	onCleanup(() => {
		cameraStream()
			?.getTracks()
			.forEach((t) => {
				t.stop();
			});
		setCameraStream(null);
		if (
			voiceChat.connection.state === ConnectionState.Connected &&
			previouslyEnabled()
		) {
			voiceChat.states.camEnabled = true;
		}
	});

	const getActiveCam = () =>
		cameras().find(
			(x) =>
				x.id === userPreferences.preferences().voice.camera.preferredDeviceId,
		) || undefined;

	return (
		<SettingsPage loading={() => false} title="Video">
			<div class="w-full aspect-video bg-muted/50 rounded-md flex items-center justify-center relative">
				<video
					ref={previewEl}
					autoplay
					playsinline
					muted
					class="w-full h-full object-cover -scale-x-100"
					classList={{ hidden: !cameraStream() }}
				/>
				<Show when={!cameraStream() && !error()}>
					<span class="absolute p-4 text-center">Loading preview...</span>
				</Show>
				<Show when={!cameraStream() && error()}>
					<span class="absolute p-4 text-center text-destructive">
						{error()}
					</span>
				</Show>
			</div>
			<div>
				<Select
					options={cameras()}
					optionValue={"id" as any}
					optionTextValue={"name" as any}
					placeholder="Default Camera"
					value={getActiveCam()}
					disallowEmptySelection={true}
					disabled={cameras().length === 0}
					itemComponent={(props) => (
						<SelectItem
							item={props.item}
							class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
							onClick={() => {
								userPreferences.setPreferences((current) => ({
									...current,
									voice: {
										...current.voice,
										camera: {
											...current.voice.camera,
											preferredDeviceId: (
												props.item.rawValue as unknown as DeviceOption
											).id,
										},
									},
								}));
							}}
						>
							{(props.item.rawValue as unknown as DeviceOption).name}
						</SelectItem>
					)}
				>
					<SelectLabel>Camera</SelectLabel>
					<SelectTrigger class="w-full" aria-label="Camera">
						<SelectValue<DeviceOption>>
							{(state) => state.selectedOption()?.name}
						</SelectValue>
					</SelectTrigger>
					<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
				</Select>
			</div>
		</SettingsPage>
	);
};

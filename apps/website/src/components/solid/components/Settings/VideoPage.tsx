import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { usePreferencesContext } from "../../contexts/UserPreferencesContext";
import { useVoiceChatContext } from "../../contexts/VoiceChatContext";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../shadcn-solid/Select";
import { SettingsPage } from "../common/SettingsModal";
import type { DeviceOption } from "./shared";

export const VideoPage: Component = () => {
	const [voiceChatContext] = useVoiceChatContext();
	const [userPreferences, setUserPreferences] = usePreferencesContext();
	const [cameraStream, setCameraStream] = createSignal<MediaStream | null>(
		null,
	);
	const [cameras, setCameras] = createSignal<Array<DeviceOption>>([]);
	const [previouslyEnabled, setPreviouslyEnabled] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	let previewEl!: HTMLVideoElement;

	onMount(async () => {
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
	});

	createEffect(() => {
		const deviceId = userPreferences.voice.camera.preferredDeviceId;

		let stream: MediaStream | null = null;
		let aborted = false;

		(async () => {
			if (
				voiceChatContext.connection.room &&
				voiceChatContext.states.camEnabled
			) {
				voiceChatContext.states.camEnabled = false;
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
					console.error("Error playing video:", e);
					setError(e instanceof Error ? e.message : e);
				});

				setError(null);
			} catch (e) {
				console.error(e);
				let errorMessage = e instanceof Error ? e.message : String(e);
				if (errorMessage === "Failed to allocate videosource") {
					errorMessage =
						"Unable to access camera. Is it already being used by a different app or not connected?";
				}
				setError(errorMessage);
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
		if (voiceChatContext.connection.room && previouslyEnabled()) {
			voiceChatContext.states.camEnabled = true;
		}
	});

	const getActiveCam = () =>
		cameras().find(
			(x) => x.id === userPreferences.voice.camera.preferredDeviceId,
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
								setUserPreferences("voice", (current) => ({
									...current,
									camera: {
										...current.camera,
										preferredDeviceId: (
											props.item.rawValue as unknown as DeviceOption
										).id,
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

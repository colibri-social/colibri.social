import { createAsync } from "@solidjs/router";
import chroma from "chroma-js";
import { createLocalAudioTrack, type LocalAudioTrack } from "livekit-client";
import { type Component, createSignal, For, Match, onCleanup } from "solid-js";
import { createIsSpeaking } from "@/lib/hooks/createIsSpeaking";
import { createRnnoiseProcessor } from "@/lib/hooks/createRnnoiseProcessor";
import { usePreferencesContext } from "../../contexts/UserPreferencesContext";
import { Button } from "../../shadcn-solid/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../shadcn-solid/Select";
import {
	Slider,
	SliderFill,
	SliderGroup,
	SliderLabel,
	SliderThumb,
	SliderTrack,
	SliderValueLabel,
} from "../../shadcn-solid/Slider";
import {
	Switch,
	Switch as SwitchComp,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../shadcn-solid/Switch";
import { SettingsPage } from "../common/SettingsModal";
import type { DeviceOption } from "./shared";

const enumerateAudioDevices = async () => {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: true,
	});

	const devices = await navigator.mediaDevices.enumerateDevices();

	stream.getTracks().forEach((track) => {
		track.stop();
	});

	return devices;
};

const MAX = 49;

export const VoicePage: Component = () => {
	const [userPreferences, setUserPreferences] = usePreferencesContext();

	const [inputGainNode, setInputGainNode] = createSignal<GainNode | null>(null);
	const [outputGainNode, setOutputGainNode] = createSignal<GainNode | null>(
		null,
	);
	const [audioCtx, setAudioCtx] = createSignal<AudioContext | null>(null);
	const [livekitTrack, setLivekitTrack] = createSignal<LocalAudioTrack | null>(
		null,
	);
	const [audioInput, setAudioInput] = createSignal<MediaStreamTrack | null>(
		null,
	);

	const spectrum = chroma
		.scale([[5, 223, 114] as any, [252, 200, 0] as any, [255, 100, 103] as any])
		.mode("oklch");

	const { volume } = createIsSpeaking(audioInput, { intervalMs: 50 });

	const getColorForIndex = (index: number) => {
		const percent = index / MAX;
		return spectrum(percent).hex();
	};

	const mediaDevices = createAsync(() => enumerateAudioDevices(), {
		initialValue: [],
	});

	const microphones = (): Array<DeviceOption> => {
		const devices = mediaDevices();
		if (!devices) return [];
		return devices
			.filter((d) => d.kind === "audioinput")
			.map((d) => ({ name: d.label, id: d.deviceId }));
	};

	const speakers = (): Array<DeviceOption> => {
		const devices = mediaDevices();
		if (!devices) return [];
		return devices
			.filter((d) => d.kind === "audiooutput")
			.map((d) => ({ name: d.label, id: d.deviceId }));
	};

	const startLocalPlayback = (
		ctx: AudioContext,
		track: MediaStreamTrack,
		inputGain: number,
		outputGain: number,
	) => {
		const source = ctx.createMediaStreamSource(new MediaStream([track]));
		const delay = ctx.createDelay(0.1);
		delay.delayTime.value = 0.02;

		const inGain = ctx.createGain();
		inGain.gain.value = inputGain;

		const outGain = ctx.createGain();
		outGain.gain.value = outputGain;

		const destination = ctx.createMediaStreamDestination();

		source.connect(delay);
		delay.connect(inGain);
		inGain.connect(outGain);
		outGain.connect(ctx.destination);

		const audioEl = document.getElementById(
			"colibri-audio-preview",
		) as HTMLAudioElement;
		audioEl.srcObject = destination.stream;

		if ("setSinkId" in ctx) {
			(ctx as any).setSinkId(
				userPreferences.voice.output.preferredDeviceId ?? "default",
			);
		}

		audioEl.play().catch(() => {});

		return { inGain, outGain };
	};

	const cleanup = () => {
		setUserPreferences("voice", (current) => ({
			...current,
			output: {
				...current.output,
				enabled: true,
			},
		}));
		audioCtx()?.close();
		setAudioCtx(null);
		livekitTrack()?.stop();
		setLivekitTrack(null);
		setAudioInput(null);
		setInputGainNode(null);
		setOutputGainNode(null);
	};

	onCleanup(cleanup);

	const toggleVoiceTest = async () => {
		const existing = livekitTrack();

		if (existing) {
			cleanup();
			return;
		}

		setUserPreferences("voice", (current) => ({
			...current,
			output: {
				...current.output,
				enabled: false,
			},
		}));

		const ctx = new AudioContext({
			latencyHint: "interactive",
			sampleRate: 48000,
		});

		const track = await createLocalAudioTrack({
			noiseSuppression: userPreferences.voice.input.noiseSuppression,
			echoCancellation: true,
			autoGainControl: true,
			deviceId: userPreferences.voice.input.preferredDeviceId,
		});

		track.setAudioContext(ctx);

		if (userPreferences.voice.input.noiseSuppression) {
			track.setProcessor(createRnnoiseProcessor());
		}

		setAudioInput(track.mediaStreamTrack);
		setLivekitTrack(track);

		const { inGain, outGain } = startLocalPlayback(
			ctx,
			track.mediaStreamTrack,
			userPreferences.voice.input.volume,
			userPreferences.voice.output.volume,
		);

		setInputGainNode(inGain);
		setOutputGainNode(outGain);
		setAudioCtx(ctx);
	};

	const restartTrackIfActive = async (
		inputOverrides?: Partial<typeof userPreferences.voice.input>,
		outputOverrides?: Partial<typeof userPreferences.voice.output>,
	) => {
		if (!livekitTrack()) return;
		const inputPrefs = { ...userPreferences.voice.input, ...inputOverrides };
		const outputPrefs = { ...userPreferences.voice.output, ...outputOverrides };

		inputGainNode()?.disconnect();
		setInputGainNode(null);
		livekitTrack()!.stop();
		setLivekitTrack(null);
		setAudioInput(null);

		const track = await createLocalAudioTrack({
			noiseSuppression: inputPrefs.noiseSuppression,
			echoCancellation: true,
			autoGainControl: true,
			deviceId: inputPrefs.preferredDeviceId,
		});

		const ctx = audioCtx()!;
		track.setAudioContext(ctx);

		if (inputPrefs.noiseSuppression) {
			await track.setProcessor(createRnnoiseProcessor());
		}

		setAudioInput(track.mediaStreamTrack);
		setLivekitTrack(track);
		const { inGain, outGain } = startLocalPlayback(
			ctx,
			track.mediaStreamTrack,
			inputPrefs.volume,
			outputPrefs.volume,
		);
		setInputGainNode(inGain);
		setOutputGainNode(outGain);
	};

	const getActiveMic = () =>
		microphones().find(
			(x) => x.id === userPreferences.voice.input.preferredDeviceId,
		) || undefined;

	return (
		<SettingsPage loading={() => false} title="Voice">
			<div class="w-full flex flex-row gap-4">
				<div class="w-full flex flex-col gap-4 min-w-[calc(50%-0.5rem)]">
					<div>
						<Select
							options={microphones()}
							optionValue={"id" as any}
							optionTextValue={"name" as any}
							placeholder="Default Input"
							value={getActiveMic()}
							disallowEmptySelection={true}
							disabled={microphones().length === 0}
							itemComponent={(props) => (
								<SelectItem
									item={props.item}
									class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
									onClick={() => {
										setUserPreferences("voice", (current) => ({
											...current,
											input: {
												...current.input,
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
							<SelectLabel>Microphone</SelectLabel>
							<SelectTrigger class="w-full" aria-label="Microphone">
								<SelectValue<DeviceOption>>
									{(state) => state.selectedOption()?.name}
								</SelectValue>
							</SelectTrigger>
							<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
						</Select>
					</div>
					<div>
						<Slider
							defaultValue={[userPreferences.voice.input.volume * 100]}
							step={1}
							maxValue={200}
							getValueLabel={(params) => `${params.values[0]}%`}
							onChange={(e) => {
								const v = e[0] / 100;

								inputGainNode()?.gain.setTargetAtTime(
									v,
									audioCtx()!.currentTime,
									0.01,
								);

								setUserPreferences("voice", (current) => ({
									...current,
									input: { ...current.input, volume: v },
								}));
							}}
						>
							<SliderGroup>
								<SliderLabel>Microphone Volume</SliderLabel>
								<SliderValueLabel />
							</SliderGroup>
							<SliderTrack>
								<SliderFill />
								<SliderThumb />
							</SliderTrack>
						</Slider>
					</div>
				</div>
				<div class="w-full flex flex-col gap-4 min-w-[calc(50%-0.5rem)]">
					<div>
						<Select
							options={speakers()}
							optionValue={"value" as any}
							optionTextValue={"name" as any}
							placeholder="Default Output"
							value={
								speakers().find(
									(x) =>
										x.id === userPreferences.voice.output.preferredDeviceId,
								)?.id || undefined
							}
							disallowEmptySelection={true}
							disabled={speakers().length === 0}
							itemComponent={(props) => (
								<SelectItem
									item={props.item}
									class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
									onClick={() =>
										setUserPreferences("voice", (current) => ({
											...current,
											output: {
												...current.output,
												preferredDeviceId: (
													props.item.rawValue as unknown as DeviceOption
												).id,
											},
										}))
									}
								>
									{(props.item.rawValue as unknown as DeviceOption).name}
								</SelectItem>
							)}
						>
							<SelectLabel>Speaker</SelectLabel>
							<SelectTrigger class="w-full" aria-label="Speaker">
								<SelectValue<DeviceOption>>
									{(state) => state.selectedOption().name}
								</SelectValue>
							</SelectTrigger>
							<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
						</Select>
					</div>
					<div>
						<Slider
							defaultValue={[userPreferences.voice.output.volume * 100]}
							step={1}
							maxValue={200}
							getValueLabel={(params) => `${params.values[0]}%`}
							onChange={(e) => {
								const v = e[0] / 100;

								outputGainNode()?.gain.setTargetAtTime(
									v,
									audioCtx()!.currentTime,
									0.01,
								);

								setUserPreferences("voice", (current) => ({
									...current,
									output: { ...current.output, volume: v },
								}));
							}}
						>
							<SliderGroup>
								<SliderLabel>Speaker Volume</SliderLabel>
								<SliderValueLabel />
							</SliderGroup>
							<SliderTrack>
								<SliderFill />
								<SliderThumb />
							</SliderTrack>
						</Slider>
					</div>
				</div>
			</div>
			<div>
				<SwitchComp
					onChange={(e) => {
						setUserPreferences("voice", (current) => ({
							...current,
							input: { ...current.input, noiseSuppression: e },
						}));
						restartTrackIfActive({ noiseSuppression: e });
					}}
					checked={userPreferences.voice.input.noiseSuppression}
					class="flex justify-between items-center gap-x-2"
				>
					<div>
						<SwitchLabel>Noise Suppression</SwitchLabel>
						<SwitchDescription>
							Whether Colibri should attempt to filter out non-voice sounds.
						</SwitchDescription>
					</div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</SwitchComp>
			</div>

			<hr class="w-full h-px bg-muted border-none m-0" />
			<div class="flex flex-row items-center gap-4 w-full">
				<Button
					onClick={toggleVoiceTest}
					class="w-28"
					variant={livekitTrack() ? "default" : "secondary"}
				>
					<Switch>
						<Match when={!livekitTrack()}>Test Input</Match>
						<Match when={livekitTrack()}>Speak now...</Match>
					</Switch>
				</Button>
				<div class="flex flex-row items-center gap-1 w-full h-8 justify-between">
					<For each={Array.from({ length: MAX })}>
						{(_, i) => (
							<div
								class="w-1 h-full bg-muted rounded-full"
								style={{
									background:
										volume() * userPreferences.voice.input.volume > i() / MAX
											? getColorForIndex(i())
											: "var(--muted)",
								}}
							/>
						)}
					</For>
				</div>
				<audio autoplay class="hidden" id={`colibri-audio-preview`} />
			</div>
		</SettingsPage>
	);
};

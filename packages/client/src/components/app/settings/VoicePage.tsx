import { createAsync } from "@solidjs/router";
import chroma from "chroma-js";
import {
	type Component,
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { Button } from "../../../components/ui/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../../components/ui/Select";
import {
	Slider,
	SliderFill,
	SliderGroup,
	SliderLabel,
	SliderThumb,
	SliderTrack,
	SliderValueLabel,
} from "../../../components/ui/Slider";
import {
	effectiveNoiseSuppressionMode,
	type NoiseSuppressionMode,
	useUserPreferences,
	type VoiceInputSettings,
	type VoiceIOSettings,
} from "../../../contexts/UserPreferences";
import { createIsSpeaking } from "../../../hooks/createIsSpeaking";
import {
	createNoiseSuppressor,
	type NoiseSuppressor,
	preloadNoiseSuppressor,
} from "../../../hooks/createNoiseSuppressor";
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

type NoiseModeOption = { id: NoiseSuppressionMode; name: string };

const NOISE_MODE_OPTIONS: Array<NoiseModeOption> = [
	{ id: "off", name: "Off" },
	{ id: "rnnoise", name: "Standard (RNNoise)" },
	{ id: "deepfilternet", name: "High quality (DeepFilterNet)" },
];

export const VoicePage: Component = () => {
	const userPreferences = useUserPreferences();

	const [inputGainNode, setInputGainNode] = createSignal<GainNode | null>(null);
	const [outputGainNode, setOutputGainNode] = createSignal<GainNode | null>(
		null,
	);
	const [audioCtx, setAudioCtx] = createSignal<AudioContext | null>(null);
	const [testStream, setTestStream] = createSignal<MediaStream | null>(null);
	const [audioInput, setAudioInput] = createSignal<MediaStreamTrack | null>(
		null,
	);
	const [suppressor, setSuppressor] = createSignal<NoiseSuppressor | null>(
		null,
	);

	onMount(() => {
		if (
			userPreferences.preferences().voice.input.noiseSuppressionMode ===
			"deepfilternet"
		) {
			preloadNoiseSuppressor();
		}
	});

	const openMic = (input: VoiceInputSettings): Promise<MediaStream> =>
		navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				autoGainControl: true,
				// The suppressor handles noise removal
				noiseSuppression: false,
				deviceId: input.preferredDeviceId
					? { ideal: input.preferredDeviceId }
					: undefined,
			},
		});

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
				userPreferences.preferences().voice.output.preferredDeviceId ??
					"default",
			);
		}

		audioEl.play().catch(() => {});

		return { inGain, outGain };
	};

	const cleanup = () => {
		userPreferences.setPreferences((current) => ({
			...current,
			voice: {
				...current.voice,
				output: {
					...current.voice.output,
					enabled: true,
				},
			},
		}));
		audioCtx()?.close();
		setAudioCtx(null);

		suppressor()?.destroy();
		setSuppressor(null);

		for (const t of testStream()?.getTracks() ?? []) t.stop();

		setTestStream(null);
		setAudioInput(null);
		setInputGainNode(null);
		setOutputGainNode(null);
	};

	onCleanup(cleanup);

	const toggleVoiceTest = async () => {
		if (testStream()) {
			cleanup();
			return;
		}

		userPreferences.setPreferences((current) => ({
			...current,
			voice: {
				...current.voice,
				output: {
					...current.voice.output,
					enabled: false,
				},
			},
		}));

		const ctx = new AudioContext({
			latencyHint: "interactive",
			sampleRate: 48000,
		});

		const input = userPreferences.preferences().voice.input;
		const stream = await openMic(input);
		const rawTrack = stream.getAudioTracks()[0];

		const ns = await createNoiseSuppressor(rawTrack, {
			desiredMode: effectiveNoiseSuppressionMode(input),
			onFallback: () => userPreferences.flagNoiseSuppressionDowngrade(),
		});
		setSuppressor(ns);

		setAudioInput(ns.outputTrack);
		setTestStream(stream);

		const { inGain, outGain } = startLocalPlayback(
			ctx,
			ns.outputTrack,
			input.volume,
			userPreferences.preferences().voice.output.volume,
		);

		setInputGainNode(inGain);
		setOutputGainNode(outGain);
		setAudioCtx(ctx);
	};

	const restartTrackIfActive = async (
		inputOverrides?: Partial<VoiceInputSettings>,
		outputOverrides?: Partial<VoiceIOSettings>,
	) => {
		if (!testStream()) return;

		const inputPrefs = {
			...userPreferences.preferences().voice.input,
			...inputOverrides,
		};
		const outputPrefs = {
			...userPreferences.preferences().voice.output,
			...outputOverrides,
		};

		inputGainNode()?.disconnect();
		setInputGainNode(null);

		suppressor()?.destroy();
		setSuppressor(null);

		for (const t of testStream()?.getTracks() ?? []) t.stop();

		setTestStream(null);
		setAudioInput(null);

		const ctx = audioCtx()!;
		const stream = await openMic(inputPrefs);
		const rawTrack = stream.getAudioTracks()[0];

		const ns = await createNoiseSuppressor(rawTrack, {
			desiredMode: effectiveNoiseSuppressionMode(inputPrefs),
			onFallback: () => userPreferences.flagNoiseSuppressionDowngrade(),
		});
		setSuppressor(ns);

		setAudioInput(ns.outputTrack);
		setTestStream(stream);

		const { inGain, outGain } = startLocalPlayback(
			ctx,
			ns.outputTrack,
			inputPrefs.volume,
			outputPrefs.volume,
		);
		setInputGainNode(inGain);
		setOutputGainNode(outGain);
	};

	const getActiveMic = () =>
		microphones().find(
			(x) =>
				x.id === userPreferences.preferences().voice.input.preferredDeviceId,
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
										userPreferences.setPreferences((current) => ({
											...current,
											voice: {
												...current.voice,
												input: {
													...current.voice.input,
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
							defaultValue={[
								userPreferences.preferences().voice.input.volume * 100,
							]}
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

								userPreferences.setPreferences((current) => ({
									...current,
									voice: {
										...current.voice,
										input: {
											...current.voice.input,
											volume: v,
										},
									},
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
										x.id ===
										userPreferences.preferences().voice.output
											.preferredDeviceId,
								)?.id || undefined
							}
							disallowEmptySelection={true}
							disabled={speakers().length === 0}
							itemComponent={(props) => (
								<SelectItem
									item={props.item}
									class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
									onClick={() =>
										userPreferences.setPreferences((current) => ({
											...current,
											voice: {
												...current.voice,
												output: {
													...current.voice.output,
													preferredDeviceId: (
														props.item.rawValue as unknown as DeviceOption
													).id,
												},
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
							defaultValue={[
								userPreferences.preferences().voice.output.volume * 100,
							]}
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

								userPreferences.setPreferences((current) => ({
									...current,
									voice: {
										...current.voice,
										output: {
											...current.voice.output,
											volume: v,
										},
									},
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
			<div class="flex flex-col gap-1">
				<Select
					options={NOISE_MODE_OPTIONS}
					optionValue={"id" as any}
					optionTextValue={"name" as any}
					value={NOISE_MODE_OPTIONS.find(
						(o) =>
							o.id ===
							userPreferences.preferences().voice.input.noiseSuppressionMode,
					)}
					disallowEmptySelection={true}
					itemComponent={(props) => (
						<SelectItem
							item={props.item}
							class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
							onClick={() => {
								userPreferences.setNoiseSuppressionMode(
									(props.item.rawValue as unknown as NoiseModeOption).id,
								);
								restartTrackIfActive();
							}}
						>
							{(props.item.rawValue as unknown as NoiseModeOption).name}
						</SelectItem>
					)}
				>
					<SelectLabel>Noise Suppression</SelectLabel>
					<SelectTrigger class="w-full" aria-label="Noise Suppression">
						<SelectValue<NoiseModeOption>>
							{(state) => state.selectedOption()?.name}
						</SelectValue>
					</SelectTrigger>
					<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
				</Select>
				<p class="text-sm text-muted-foreground">
					How aggressively Colibri filters out non-voice sounds. High quality
					uses DeepFilterNet and automatically falls back to Standard if this
					device can't keep up.
				</p>
				<Show
					when={
						userPreferences.preferences().voice.input.noiseSuppressionMode ===
							"deepfilternet" &&
						userPreferences.preferences().voice.input
							.noiseSuppressionAutoDowngraded
					}
				>
					<p class="text-sm text-yellow-500">
						High quality was switched off because this device couldn't keep up.
						Select it again to retry.
					</p>
				</Show>
			</div>

			<hr class="w-full h-px bg-muted border-none m-0" />
			<div class="flex flex-row items-center gap-4 w-full">
				<Button
					onClick={toggleVoiceTest}
					class="w-28"
					variant={testStream() ? "default" : "secondary"}
				>
					<Switch>
						<Match when={!testStream()}>
							<span>Test Input</span>
						</Match>
						<Match when={testStream()}>
							<span>Speak now...</span>
						</Match>
					</Switch>
				</Button>
				<div class="flex flex-row items-center gap-1 w-full h-8 justify-between">
					<For each={Array.from({ length: MAX })}>
						{(_, i) => (
							<div
								class="w-1 h-full bg-muted rounded-full"
								style={{
									background:
										volume() *
											userPreferences.preferences().voice.input.volume >
										i() / MAX
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

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
import { toast } from "somoto";
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
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
	Switch as ToggleSwitch,
} from "../../../components/ui/Switch";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import {
	type NoiseSuppressionMode,
	useUserPreferences,
	type VoiceInputSettings,
	type VoiceIOSettings,
} from "../../../contexts/UserPreferences";
import { useVoiceChatContext } from "../../../contexts/VoiceChat";
import { useExperiment } from "../../../experiments";
import { createIsSpeaking } from "../../../hooks/createIsSpeaking";
import {
	createNoiseSuppressor,
	type NoiseSuppressor,
	preloadNoiseSuppressor,
} from "../../../hooks/createNoiseSuppressor";
import {
	createSuppressionMonitor,
	type SuppressionMonitor,
} from "../../../hooks/createSuppressionMonitor";
import {
	createVoiceLoopback,
	type VoiceLoopback,
} from "../../../hooks/createVoiceLoopback";
import {
	EXPERIMENTAL_DENOISERS_EXPERIMENT,
	NOISE_MODES,
	noiseMode,
} from "../../../hooks/noise/modes";
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

export const VoicePage: Component = () => {
	const userPreferences = useUserPreferences();
	const auth = useAuthContext();
	const user = useUserContext();
	const [voiceData, { toggleMic }] = useVoiceChatContext();

	const [loopback, setLoopback] = createSignal<VoiceLoopback | null>(null);
	const [audioCtx, setAudioCtx] = createSignal<AudioContext | null>(null);
	const [testStream, setTestStream] = createSignal<MediaStream | null>(null);
	const [audioInput, setAudioInput] = createSignal<MediaStreamTrack | null>(
		null,
	);
	const [suppressor, setSuppressor] = createSignal<NoiseSuppressor | null>(
		null,
	);
	const [monitor, setMonitor] = createSignal<SuppressionMonitor | null>(null);
	const [wasLiveMicOn, setWasLiveMicOn] = createSignal(false);

	const experimentalDenoisers = useExperiment(
		EXPERIMENTAL_DENOISERS_EXPERIMENT,
	);

	const currentMode = () =>
		noiseMode(userPreferences.preferences().voice.input.noiseSuppressionMode);

	const noiseModeOptions = (): Array<NoiseModeOption> =>
		NOISE_MODES.filter(
			(mode) => !mode.experimental || experimentalDenoisers(),
		).map((mode) => ({ id: mode.id, name: mode.label }));

	onMount(() => {
		if (currentMode().usesDeepFilterNet) preloadNoiseSuppressor();
	});

	const handleSuppressorFallback = (
		_from: NoiseSuppressionMode,
		to: NoiseSuppressionMode,
	) => {
		userPreferences.setNoiseSuppressionMode(to);
		toast(
			`Switched to ${noiseMode(to).label.toLowerCase()} noise suppression`,
			{
				description:
					"The mode you picked couldn't run smoothly on this device.",
			},
		);
	};

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

	const startLoopback = (
		ctx: AudioContext,
		track: MediaStreamTrack,
		inputGain: number,
		outputGain: number,
	) => {
		if (!auth?.loggedIn) return;

		const lb = createVoiceLoopback({
			agent: auth.agent,
			did: user.did,
			sourceTrack: track,
			audioCtx: ctx,
			outputDeviceId:
				userPreferences.preferences().voice.output.preferredDeviceId ??
				undefined,
		});

		lb.inGain.gain.value = inputGain;
		lb.setOutputVolume(outputGain);

		setLoopback(lb);
	};

	const startMonitor = (
		rawTrack: MediaStreamTrack,
		processedTrack: MediaStreamTrack,
	) => {
		setMonitor(
			createSuppressionMonitor({
				rawTrack,
				processedTrack,
				isActive: () => !!testStream(),
				isTunable: () =>
					noiseMode(suppressor()?.getActiveMode() ?? "off").tunable,
				hintsEnabled: () =>
					userPreferences.preferences().voice.noiseSuppressionHints,
				getLevel: () =>
					userPreferences.preferences().voice.input.noiseSuppressionLevel,
				setLevel: (level) => {
					userPreferences.setNoiseSuppressionLevel(level);
					suppressor()?.setSuppressionLevel(level);
				},
				disableHints: () => userPreferences.setNoiseSuppressionHints(false),
			}),
		);
	};

	const cleanup = () => {
		monitor()?.destroy();
		setMonitor(null);

		loopback()?.destroy();
		setLoopback(null);

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

		if (wasLiveMicOn()) {
			toggleMic();
			setWasLiveMicOn(false);
		}
	};

	onCleanup(cleanup);

	const toggleVoiceTest = async () => {
		if (testStream()) {
			cleanup();
			return;
		}

		if (voiceData.states.micEnabled) {
			setWasLiveMicOn(true);
			toggleMic();
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
			desiredMode: input.noiseSuppressionMode,
			suppressionLevel: input.noiseSuppressionLevel,
			onFallback: handleSuppressorFallback,
		});
		setSuppressor(ns);

		setAudioInput(ns.outputTrack);
		setTestStream(stream);

		startLoopback(
			ctx,
			ns.outputTrack,
			input.volume,
			userPreferences.preferences().voice.output.volume,
		);
		startMonitor(rawTrack, ns.outputTrack);

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

		monitor()?.destroy();
		setMonitor(null);

		loopback()?.destroy();
		setLoopback(null);

		suppressor()?.destroy();
		setSuppressor(null);

		for (const t of testStream()?.getTracks() ?? []) t.stop();

		setTestStream(null);
		setAudioInput(null);

		const ctx = audioCtx()!;
		const stream = await openMic(inputPrefs);
		const rawTrack = stream.getAudioTracks()[0];

		const ns = await createNoiseSuppressor(rawTrack, {
			desiredMode: inputPrefs.noiseSuppressionMode,
			suppressionLevel: inputPrefs.noiseSuppressionLevel,
			onFallback: handleSuppressorFallback,
		});
		setSuppressor(ns);

		setAudioInput(ns.outputTrack);
		setTestStream(stream);

		startLoopback(ctx, ns.outputTrack, inputPrefs.volume, outputPrefs.volume);
		startMonitor(rawTrack, ns.outputTrack);
	};

	const getActiveMic = () =>
		microphones().find(
			(x) =>
				x.id === userPreferences.preferences().voice.input.preferredDeviceId,
		) || undefined;

	return (
		<SettingsPage loading={() => false} title="Voice">
			<div class="@container w-full">
				<div class="grid grid-cols-1 @min-[500px]:grid-cols-2 gap-4">
					<div class="flex flex-col gap-4 min-w-0">
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

									loopback()?.inGain.gain.setTargetAtTime(
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
					<div class="flex flex-col gap-4 min-w-0">
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

									loopback()?.setOutputVolume(v);

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
			</div>
			<div class="flex flex-col gap-1">
				<Select
					options={noiseModeOptions()}
					optionValue={"id" as any}
					optionTextValue={"name" as any}
					value={noiseModeOptions().find(
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
				<p class="text-sm text-muted-foreground my-1">
					{currentMode().description}
					<Show
						when={currentMode().usesDeepFilterNet || currentMode().experimental}
					>
						{" "}
						Colibri drops to a lighter mode automatically if this device can't
						keep up.
					</Show>
				</p>
				<Show when={currentMode().tunable}>
					<Slider
						defaultValue={[
							userPreferences.preferences().voice.input.noiseSuppressionLevel,
						]}
						step={1}
						maxValue={100}
						getValueLabel={(params) => `${params.values[0]}%`}
						onChange={(e) => {
							const v = e[0];
							userPreferences.setNoiseSuppressionLevel(v);
							suppressor()?.setSuppressionLevel(v);
						}}
					>
						<SliderGroup>
							<SliderLabel>Suppression Strength</SliderLabel>
							<SliderValueLabel />
						</SliderGroup>
						<SliderTrack>
							<SliderFill />
							<SliderThumb />
						</SliderTrack>
					</Slider>
				</Show>
				<ToggleSwitch
					class="flex flex-row items-center justify-between gap-4 mt-1"
					checked={userPreferences.preferences().voice.noiseSuppressionHints}
					onChange={(v) => userPreferences.setNoiseSuppressionHints(v)}
				>
					<div class="flex flex-col gap-1">
						<SwitchLabel>Suppression tips</SwitchLabel>
						<SwitchDescription class="text-sm text-muted-foreground max-w-120">
							Occasionally suggest adjusting the strength during calls when your
							voice gets cut off or background noise comes through.
						</SwitchDescription>
					</div>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</ToggleSwitch>
			</div>

			<hr class="w-full h-px bg-muted border-none m-0" />
			<div class="flex flex-row items-center gap-4 w-full">
				<Button
					onClick={toggleVoiceTest}
					class="w-28 shrink-0"
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
				<div class="flex flex-row items-center gap-0.5 h-8 flex-1 min-w-0">
					<For each={Array.from({ length: MAX })}>
						{(_, i) => (
							<div
								class="flex-1 min-w-0 h-full bg-muted rounded-full"
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
			</div>
		</SettingsPage>
	);
};

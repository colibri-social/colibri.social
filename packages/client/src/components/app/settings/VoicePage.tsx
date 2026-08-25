import { createAsync } from "@solidjs/router";
import chroma from "chroma-js";
import {
	type Component,
	createSignal,
	For,
	Match,
	onCleanup,
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
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
	Switch as ToggleSwitch,
} from "../../../components/ui/Switch";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import {
	useUserPreferences,
	type VoiceInputSettings,
	type VoiceIOSettings,
} from "../../../contexts/UserPreferences";
import { useVoiceChatContext } from "../../../contexts/VoiceChat";
import { classifyThrown } from "../../../errors/classify";
import { showError } from "../../../errors/show-error";
import { createIsSpeaking } from "../../../hooks/createIsSpeaking";
import {
	captureConstraints,
	createNoiseSuppressor,
	type NoiseSuppressor,
} from "../../../hooks/createNoiseSuppressor";
import {
	createVoiceLoopback,
	type VoiceLoopback,
} from "../../../hooks/createVoiceLoopback";
import { createLogger } from "../../../utils/logger";
import { isDeviceOutcome } from "../../../utils/voice-device";
import { SettingsPage } from "../common/SettingsModal";
import type { DeviceOption } from "./shared";

const log = createLogger("settings/voice");

const enumerateAudioDevices = async (): Promise<Array<MediaDeviceInfo>> => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: true,
		});

		const devices = await navigator.mediaDevices.enumerateDevices();

		stream.getTracks().forEach((track) => {
			track.stop();
		});

		return devices;
	} catch (err) {
		log.warn("listing microphones failed", { code: classifyThrown(err).code });
		return [];
	}
};

const reportMicTestFailure = (err: unknown, fallbackTitle: string): void => {
	const { code } = classifyThrown(err);
	log.warn("the microphone test could not open an input device", { code });
	showError(err, { report: !isDeviceOutcome(code), fallbackTitle });
};

const MAX = 49;

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
	const [wasLiveMicOn, setWasLiveMicOn] = createSignal(false);

	const openMic = (input: VoiceInputSettings): Promise<MediaStream> =>
		navigator.mediaDevices.getUserMedia({
			audio: captureConstraints(input.preferredDeviceId),
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

	const cleanup = () => {
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
		setAudioCtx(ctx);

		try {
			const input = userPreferences.preferences().voice.input;
			const stream = await openMic(input);
			const rawTrack = stream.getAudioTracks()[0];

			const ns = await createNoiseSuppressor(rawTrack, {
				suppression: input.noiseSuppression,
				gate: input.voiceGate,
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
		} catch (err) {
			reportMicTestFailure(err, "Couldn't start the microphone test.");
			cleanup();
		}
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

		loopback()?.destroy();
		setLoopback(null);

		suppressor()?.destroy();
		setSuppressor(null);

		for (const t of testStream()?.getTracks() ?? []) t.stop();

		setTestStream(null);
		setAudioInput(null);

		const ctx = audioCtx()!;

		try {
			const stream = await openMic(inputPrefs);
			const rawTrack = stream.getAudioTracks()[0];

			const ns = await createNoiseSuppressor(rawTrack, {
				suppression: inputPrefs.noiseSuppression,
				gate: inputPrefs.voiceGate,
			});
			setSuppressor(ns);

			setAudioInput(ns.outputTrack);
			setTestStream(stream);

			startLoopback(ctx, ns.outputTrack, inputPrefs.volume, outputPrefs.volume);
		} catch (err) {
			reportMicTestFailure(err, "Couldn't reopen the microphone.");
			cleanup();
		}
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
											restartTrackIfActive({
												preferredDeviceId: (
													props.item.rawValue as unknown as DeviceOption
												).id,
											});
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
			<div class="flex flex-col gap-3">
				<ToggleSwitch
					class="flex flex-row items-center justify-between gap-4"
					checked={userPreferences.preferences().voice.input.noiseSuppression}
					onChange={(v) => {
						userPreferences.setNoiseSuppression(v);
						suppressor()?.setSuppression(v);
					}}
				>
					<div class="flex flex-col gap-1">
						<SwitchLabel>Noise Suppression</SwitchLabel>
						<SwitchDescription class="text-sm text-muted-foreground max-w-120">
							RNNoise removes background noise like fans, hum and keyboards
							before your microphone is sent.
						</SwitchDescription>
					</div>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</ToggleSwitch>
				<ToggleSwitch
					class="flex flex-row items-center justify-between gap-4"
					checked={userPreferences.preferences().voice.input.voiceGate}
					onChange={(v) => {
						userPreferences.setVoiceGate(v);
						suppressor()?.setGate(v);
					}}
				>
					<div class="flex flex-col gap-1">
						<SwitchLabel>Voice Gate</SwitchLabel>
						<SwitchDescription class="text-sm text-muted-foreground max-w-120">
							Mute your microphone entirely between sentences, so silence stays
							silent.
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

import { actions } from "astro:actions";
import { APPVIEW_DOMAIN } from "astro:env/client";
import type { Details } from "@kobalte/core/file-field";
import twemoji from "@twemoji/api";
import type { ParentComponent } from "solid-js";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	Match,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import { Icon } from "@/components/solid/icons/Icon";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../contexts/GlobalContext";
import { usePreferencesContext } from "../contexts/UserPreferencesContext";
import { PDSls } from "../icons/PDSls";
import chroma from "chroma-js";
import { Button } from "../shadcn-solid/Button";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
} from "../shadcn-solid/file-field";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "../shadcn-solid/text-field";
import { EmojiPopover } from "./Message/EmojiPopover";
import { InfoPageItem } from "./SettingsInfoPage";
import { SettingsModal, SettingsPage } from "./SettingsModal";
import { createAsync } from "@solidjs/router";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../shadcn-solid/Select";
import {
	Slider,
	SliderFill,
	SliderGroup,
	SliderLabel,
	SliderThumb,
	SliderTrack,
	SliderValueLabel,
} from "../shadcn-solid/Slider";
import { createIsSpeaking } from "@/lib/hooks/createIsSpeaking";
import {
	Switch as SwitchComp,
	SwitchLabel,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchThumb,
} from "../shadcn-solid/Switch";

const GeneralSettingsPage: Component = () => {
	const [globalData, { setUserData }] = useGlobalContext();

	const [loading, setLoading] = createSignal<boolean>(false);

	const [banner, setBanner] = createSignal<Details>();
	const [image, setImage] = createSignal<Details>();
	const [name, setName] = createSignal(globalData.user.displayName || "");
	const [description, setDescription] = createSignal(
		globalData.user.description || "",
	);

	const [imageRemoved, setImageRemoved] = createSignal(false);
	const [bannerRemoved, setBannerRemoved] = createSignal(false);

	const [status, setStatus] = createSignal(globalData.user.status);

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (globalData.user.avatar ?? null)
			: null;

	const existingBannerUrl = () =>
		!bannerRemoved() && banner() === undefined
			? (globalData.user.banner ?? null)
			: null;

	const hasEdited = (): boolean =>
		name() !== globalData.user.displayName ||
		description() !== globalData.user.description ||
		status() !== globalData.user.status ||
		imageRemoved() ||
		bannerRemoved() ||
		image() !== undefined ||
		banner() !== undefined;

	const cdnUrlToAppViewUrl = (url: string | null) => {
		if (!url) return null;
		if (!url.startsWith("https://cdn.bsky.app")) return url;

		const split = url.split("/");
		const did = split[6];
		const cid = split[7];

		return `https://${APPVIEW_DOMAIN}/api/blob?did=${did}&cid=${cid}`;
	};

	const saveProfile = async () => {
		setLoading(true);

		// Download original image, convert to base64 if defined and not changed
		const existingImage = cdnUrlToAppViewUrl(existingImageUrl());
		const existingBanner = cdnUrlToAppViewUrl(existingBannerUrl());
		const reader = new FileReader();

		let imageBase64: string | undefined;
		let imageMimeType: string | undefined;
		let bannerBase64: string | undefined;
		let bannerMimeType: string | undefined;

		if (existingImage) {
			const originalImage = await (await fetch(existingImage)).blob();

			imageBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(originalImage);
			});

			imageMimeType = originalImage.type;
			// Get mime type for image, convert to base64
		} else if (image()) {
			imageBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(image()!.acceptedFiles[0]);
			});

			imageMimeType = image()!.acceptedFiles[0].type;
		}

		if (existingBanner) {
			const originalImage = await (await fetch(existingBanner)).blob();

			bannerBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(originalImage);
			});

			bannerMimeType = originalImage.type;
			// Get mime type for image, convert to base64
		} else if (banner()) {
			bannerBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(banner()!.acceptedFiles[0]);
			});

			bannerMimeType = banner()!.acceptedFiles[0].type;
		}

		const userData = await actions.editProfile({
			name: name(),
			description: description(),
			image: imageBase64
				? {
						base64: imageBase64,
						type: imageMimeType!,
					}
				: undefined,
			banner: bannerBase64
				? {
						base64: bannerBase64,
						type: bannerMimeType!,
					}
				: undefined,
		});

		if (userData.error) {
			setLoading(false);
			toast.error("Failed to update profile", {
				description: parseZodToErrorOrDisplay(userData.error.message),
			});
			return;
		}

		setUserData({
			...globalData.user,
			displayName: name(),
			description: description(),
			avatar: userData.data.imageUrl,
			banner: userData.data.bannerUrl,
		});
		resetEdits();
		setLoading(false);
	};

	const resetEdits = () => {
		setName(globalData.user.displayName || "");
		setDescription(globalData.user.description || "");
		setImage(undefined);
		setBanner(undefined);
		setImageRemoved(false);
		setBannerRemoved(false);
		setStatus(globalData.user.status);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={hasEdited()}
			title="Profile"
			onSave={saveProfile}
			onReset={resetEdits}
		>
			<div class="w-full flex flex-col rounded-2xl border border-border bg-card text-foreground overflow-hidden relative">
				<FileField
					class="items-start absolute w-full aspect-3/1 h-auto"
					onFileChange={setBanner}
					maxFiles={1}
				>
					<FileFieldDropzone class="w-full h-full rounded-none border-none">
						<FileFieldTrigger class="h-full w-full p-0 bg-muted/25 hover:bg-muted/50 overflow-hidden rounded-none">
							<Switch>
								<Match when={banner() !== undefined}>
									<div class="relative h-full w-full">
										<FileFieldItemList class="h-full w-full m-0 p-0">
											{() => (
												<FileFieldItem class="h-full w-full m-0 p-0 border-none block [&>div]:w-full [&>div]:h-full">
													<FileFieldItemPreviewImage class="h-full w-full aspect-3/1 self-center object-cover rounded-none" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
									</div>
								</Match>
								<Match when={existingBannerUrl() !== null}>
									<div class="relative h-full w-full">
										<img
											src={existingBannerUrl()!}
											alt={name()}
											class="h-full w-full object-cover aspect-3/1"
										/>
									</div>
								</Match>
								<Match when={true}>
									<div class="flex flex-col items-center justify-center gap-1">
										<Icon
											variant="regular"
											name="image-icon"
											class="w-6! h-6!"
										/>
										<span>Upload</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>
				<div class="flex flex-col mt-32 p-4 gap-2">
					<FileField class="items-start" onFileChange={setImage} maxFiles={1}>
						<FileFieldDropzone class="h-24 w-24 min-h-0 rounded-full">
							<FileFieldTrigger class="h-24 w-24 p-0 bg-muted/25 hover:bg-muted/50 rounded-full overflow-hidden">
								<Switch>
									<Match when={image() !== undefined}>
										<div class="relative w-24 h-24">
											<FileFieldItemList class="w-24 h-24 m-0 p-0">
												{() => (
													<FileFieldItem class="w-24 h-24 m-0 p-0 border-none [&>div]:w-24">
														<FileFieldItemPreviewImage class="w-24 h-24 object-cover" />
													</FileFieldItem>
												)}
											</FileFieldItemList>
										</div>
									</Match>
									<Match when={existingImageUrl() !== null}>
										<div class="relative w-24 h-24">
											<img
												src={existingImageUrl()!}
												alt={name()}
												class="w-24 h-24 object-cover"
											/>
										</div>
									</Match>
									<Match when={true}>
										<div class="flex flex-col items-center justify-center gap-1">
											<Icon
												variant="regular"
												name="image-icon"
												class="w-6! h-6!"
											/>
											<span>Upload</span>
										</div>
									</Match>
								</Switch>
							</FileFieldTrigger>
						</FileFieldDropzone>
						<FileFieldHiddenInput />
					</FileField>
					<TextField
						value={name()}
						onChange={setName}
						validationState={
							name() !== undefined &&
							name()!.trim().length < 64 &&
							name()!.trim().length > 0
								? "valid"
								: "invalid"
						}
					>
						<TextFieldLabel>Display Name</TextFieldLabel>
						<TextFieldInput maxLength={32} minLength={1} type="text" required />
					</TextField>
					<TextField
						value={description()}
						onChange={setDescription}
						validationState={
							description() !== undefined && description()!.trim().length < 257
								? "valid"
								: "invalid"
						}
					>
						<TextFieldLabel>Community Description</TextFieldLabel>
						<TextFieldTextArea
							rows={10}
							maxLength={256}
							required
							class="resize-none"
						/>
					</TextField>
				</div>
			</div>
		</SettingsPage>
	);
};

const StatusPage: Component = () => {
	const [globalData, { setUserData }] = useGlobalContext();
	const [loading, setLoading] = createSignal(false);
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	const [status, setStatus] = createSignal(globalData.user.status || "");
	const [emoji, setEmoji] = createSignal(globalData.user.emoji || "");

	const saveStatus = async () => {
		setLoading(true);

		const statusRes = await actions.setStatus({
			status: status(),
			emoji: emoji(),
		});

		setLoading(false);

		if (statusRes.error) {
			toast.error("Failed to update status", {
				description: parseZodToErrorOrDisplay(statusRes.error.message),
			});
			return;
		}

		setUserData({
			...globalData.user,
			status: status(),
			emoji: emoji(),
		});

		resetStatus();
	};

	const resetStatus = async () => {
		setStatus(globalData.user.status || "");
		setEmoji(globalData.user.emoji || "");
		setLoading(false);
	};

	const hasEdited = () =>
		status() !== (globalData.user.status || "") ||
		emoji() !== (globalData.user.emoji || "");

	return (
		<SettingsPage
			loading={loading}
			title="Status"
			onSave={saveStatus}
			onReset={resetStatus}
			canReset={hasEdited()}
		>
			<TextField
				value={status()}
				onChange={setStatus}
				validationState={
					status() !== undefined && status()!.trim().length < 33
						? "valid"
						: "invalid"
				}
				class="gap-0 relative"
			>
				<EmojiPopover
					emojiPopoverOpen={popoverOpen}
					setEmojiPopoverOpen={setPopoverOpen}
					onEmojiClick={(e) => setEmoji(e.emoji)}
				>
					<Button
						variant="secondary"
						class="absolute top-0.5 left-0.5 rounded-sm w-8 h-8 p-2"
						size="sm"
					>
						<Switch>
							<Match when={emoji()}>
								<div innerHTML={twemoji.parse(emoji())} />
							</Match>
							<Match when={!emoji()}>
								<Icon variant="regular" name="smiley-icon" />
							</Match>
						</Switch>
					</Button>
				</EmojiPopover>
				<TextFieldInput
					maxLength={32}
					required
					type="text"
					class="resize-none pl-10"
				/>
			</TextField>
			<Button
				variant="secondary"
				classList={{
					"hidden!":
						hasEdited() || (emoji()?.length === 0 && status()?.length === 0),
				}}
				onClick={() => {
					setEmoji("");
					setStatus("");
					saveStatus();
				}}
			>
				Reset Status
			</Button>
		</SettingsPage>
	);
};

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

type DeviceOption = {
	name: string;
	id: string;
};

const MAX = 49;

const lerp = (start: number, end: number, t: number) =>
	start + t * (end - start);

const VoicePage: Component = () => {
	const [userPreferences, setUserPreferences] = usePreferencesContext();
	const [globalData, { setUserData }] = useGlobalContext();
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
			.map((d) => ({
				name: d.label,
				id: d.deviceId,
			}));
	};

	const speakers = (): Array<DeviceOption> => {
		const devices = mediaDevices();

		if (!devices) return [];

		return devices
			.filter((d) => d.kind === "audiooutput")
			.map((d) => ({
				name: d.label,
				id: d.deviceId,
			}));
	};

	const toggleVoiceTest = async () => {
		if (audioInput()) {
			audioInput()!.stop();
			setAudioInput(null);
		} else {
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			const audioTrack = mediaStream.getAudioTracks()[0];

			setAudioInput(audioTrack);
		}
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
								setUserPreferences("voice", (current) => ({
									...current,
									input: {
										...current.input,
										volume: e[0] / 100,
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
										x.id === userPreferences.voice.output.preferredDeviceId,
								)?.id || undefined
							}
							disallowEmptySelection={true}
							disabled={microphones().length === 0}
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
						<div>
							<Slider
								defaultValue={[userPreferences.voice.output.volume * 100]}
								step={1}
								maxValue={200}
								getValueLabel={(params) => `${params.values[0]}%`}
								onChange={(e) => {
									setUserPreferences("voice", (current) => ({
										...current,
										output: {
											...current.output,
											volume: e[0] / 100,
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
			<div class="flex flex-row items-center gap-4 w-full">
				<Button onClick={toggleVoiceTest} class="w-28">
					<Switch>
						<Match when={!audioInput()}>Test Input</Match>
						<Match when={audioInput()}>Speak now...</Match>
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
			</div>
			<hr class="w-full h-px bg-muted border-none m-0" />

			<div>
				<SwitchComp
					onChange={(e) => {
						setUserPreferences("voice", (current) => ({
							...current,
							input: {
								...current.input,
								noiseSurpression: e,
							},
						}));
					}}
					checked={userPreferences.voice.input.noiseSurpression}
					class="flex justify-between items-center gap-x-2"
				>
					<div>
						<SwitchLabel>Noise Surpression</SwitchLabel>
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
			<div>
				<SwitchComp
					onChange={(e) => {
						setUserPreferences("voice", (current) => ({
							...current,
							input: {
								...current.input,
								echoCancellation: e,
							},
						}));
					}}
					checked={userPreferences.voice.input.echoCancellation}
					class="flex justify-between items-center gap-x-2"
				>
					<div>
						<SwitchLabel>Echo Cancellation</SwitchLabel>
						<SwitchDescription>
							Whether Colibri should attempt to filter out echoes.
						</SwitchDescription>
					</div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</SwitchComp>
			</div>
		</SettingsPage>
	);
};

const VideoPage: Component = () => {
	const [userPreferences, setUserPreferences] = usePreferencesContext();
	const [globalData, { setUserData }] = useGlobalContext();

	// Open media stream to camera, display preview

	return (
		<SettingsPage loading={() => false} title="Video">
			<div>(Cam Test)</div>
			<div>(Cam select)</div>
		</SettingsPage>
	);
};

const DebugPage: Component = () => {
	const [globalData] = useGlobalContext();

	const atUri = `at://${globalData.user.sub}`;
	return (
		<SettingsPage loading={() => false} title="Debug Information">
			<div class="flex flex-col gap-4">
				<InfoPageItem title="DID" value={globalData.user.sub} />
				<InfoPageItem title="AT-URI" value={atUri} />
				<a
					href={`https://pdsls.dev/${atUri}`}
					target="_blank"
					class="font-normal hover:underline w-fit flex flex-row gap-2 items-center mt-4 text-[#76c4e5]"
				>
					<PDSls />
					<span class="text-foreground">View on PDSls</span>
				</a>
			</div>
		</SettingsPage>
	);
};

export const UserSettingsModal: ParentComponent = (props) => {
	return (
		<SettingsModal
			pages={[
				{
					title: "Profile",
					id: "general",
					component: GeneralSettingsPage,
					icon: "user-circle-icon",
				},
				{
					title: "Status",
					id: "status",
					component: StatusPage,
					icon: "smiley-icon",
				},
				{
					title: "Voice",
					id: "voice",
					component: VoicePage,
					icon: "microphone-icon",
				},
				{
					title: "Video",
					id: "video",
					component: VideoPage,
					icon: "camera-icon",
				},
			]}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: DebugPage,
				icon: "bug-icon",
			}}
			contentClass="min-h-192!"
		>
			{props.children}
		</SettingsModal>
	);
};

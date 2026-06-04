import {
	createResource,
	createSignal,
	For,
	Match,
	Show,
	Switch,
	type Accessor,
	type Setter,
} from "solid-js";
import { toast } from "somoto";
import { putRecord } from "../../atproto/pds";
import { useUserContext } from "../../contexts/User";
import User from "./user";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
} from "../ui/FileField";
import { TextField, TextFieldInput, TextFieldLabel } from "../ui/TextField";
import { Image } from "../icons/Image";
import {
	useUserPreferences,
} from "../../contexts/UserPreferences";
import { Button } from "../ui/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
} from "../ui/Dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select";
import { Slider, SliderFill, SliderThumb, SliderTrack } from "../ui/Slider";
import { Switch as ToggleSwitch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/Switch";
import { SettingsPage } from "./common/SettingsModal";
import GearIcon from "~icons/ph/gear";
import UserIcon from "~icons/ph/user";
import BugIcon from "~icons/ph/bug";
import SpeakerHighIcon from "~icons/ph/speaker-high";
import MicrophoneIcon from "~icons/ph/microphone";
import XIcon from "~icons/ph/x";

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

const ProfilePage = () => {
	const user = useUserContext();
	const [loading, setLoading] = createSignal(false);
	const [displayName, setDisplayName] = createSignal(user.data.displayName ?? "");
	const [description, setDescription] = createSignal(user.data.description ?? "");
	const [avatarFile, setAvatarFile] = createSignal<File | undefined>(undefined);
	const [avatarPreview, setAvatarPreview] = createSignal<string | undefined>(undefined);

	const isDirty = () =>
		displayName() !== (user.data.displayName ?? "") ||
		description() !== (user.data.description ?? "") ||
		avatarFile() !== undefined;

	const handleAvatarChange = (file: File | undefined) => {
		setAvatarFile(file);
		if (!file) { setAvatarPreview(undefined); return; }
		const reader = new FileReader();
		reader.onload = () => setAvatarPreview(reader.result as string);
		reader.readAsDataURL(file);
	};

	const handleSave = async () => {
		setLoading(true);
		try {
			let avatarBlob: unknown = user.data.avatar;

			if (avatarFile()) {
				const res = await user.atproto.agent.com.atproto.repo.uploadBlob(
					avatarFile()!,
					{ encoding: avatarFile()!.type },
				);
				avatarBlob = res.data.blob;
			}

			await putRecord(
				user.atproto.agent,
				user.did,
				"app.bsky.actor.profile",
				"self",
				{
					displayName: displayName(),
					description: description(),
					...(avatarBlob ? { avatar: avatarBlob } : {}),
					...(user.data.banner ? { banner: user.data.banner } : {}),
				},
			);

			user.updateActorData({ displayName: displayName(), description: description() });
			setAvatarFile(undefined);
			toast.success("Profile saved.");
		} catch (err) {
			console.error("[ProfilePage] save failed", err);
			toast.error("Failed to save profile.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<SettingsPage
			loading={loading}
			title="Profile"
			canReset={isDirty()}
			onSave={handleSave}
		>
			<div class="flex flex-col gap-6">
				{/* Avatar */}
				<div class="flex flex-row items-center gap-4">
					<FileField
						onFileChange={(d) => handleAvatarChange(d?.acceptedFiles[0])}
						maxFiles={1}
						accept="image/*"
					>
						<FileFieldDropzone class="w-16 h-16 min-h-0 rounded-full overflow-hidden">
							<FileFieldTrigger class="h-16 w-16 bg-muted/25 text-muted-foreground hover:bg-muted/50 cursor-pointer">
								<Show
									when={avatarPreview()}
									fallback={
										<Show
											when={user.data.avatar}
											fallback={<Image className="w-5! h-5!" />}
										>
											<User.Avatar user={user} size="large" />
										</Show>
									}
								>
									{(src) => (
										<img
											src={src()}
											class="w-16 h-16 object-cover"
											alt="Avatar preview"
										/>
									)}
								</Show>
							</FileFieldTrigger>
						</FileFieldDropzone>
						<FileFieldHiddenInput />
					</FileField>
					<div class="flex flex-col gap-0.5">
						<span class="font-semibold">{user.handle}</span>
						<span class="text-xs text-muted-foreground">
							Click the circle to change your avatar
						</span>
					</div>
				</div>

				{/* Display name */}
				<TextField value={displayName()} onChange={setDisplayName}>
					<TextFieldLabel>Display name</TextFieldLabel>
					<TextFieldInput maxLength={64} type="text" placeholder={user.handle} />
				</TextField>

				{/* Bio */}
				<TextField value={description()} onChange={setDescription}>
					<TextFieldLabel>Bio</TextFieldLabel>
					<TextFieldInput maxLength={256} type="text" placeholder="Tell people about yourself" />
				</TextField>
			</div>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Voice & Audio page (stub — device enumeration works, no actual VC yet)
// ---------------------------------------------------------------------------

type MediaDevice = { deviceId: string; label: string };

const VoicePage = () => {
	const { preferences, updateVoice } = useUserPreferences();

	const [devices] = createResource(async () => {
		try {
			await navigator.mediaDevices.getUserMedia({ audio: true });
			const all = await navigator.mediaDevices.enumerateDevices();
			return {
				inputs: all
					.filter((d) => d.kind === "audioinput")
					.map(
						(d): MediaDevice => ({
							deviceId: d.deviceId,
							label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
						}),
					),
				outputs: all
					.filter((d) => d.kind === "audiooutput")
					.map(
						(d): MediaDevice => ({
							deviceId: d.deviceId,
							label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
						}),
					),
			};
		} catch {
			return { inputs: [], outputs: [] };
		}
	});

	const voicePrefs = () => preferences().voice;

	return (
		<SettingsPage loading={() => false} title="Voice & Audio">
			<div class="flex flex-col gap-6">
				{/* Input device */}
				<div class="flex flex-col gap-2">
					<label class="text-sm font-medium flex items-center gap-2">
						<MicrophoneIcon />
						Microphone
					</label>
					<Select
						value={voicePrefs().inputDeviceId ?? "default"}
						onChange={(v) => updateVoice({ inputDeviceId: v })}
						options={[
							{ deviceId: "default", label: "Default" },
							...(devices()?.inputs ?? []),
						]}
						optionValue="deviceId"
						optionTextValue="label"
						itemComponent={(p) => (
							<SelectItem item={p.item}>{p.item.rawValue.label}</SelectItem>
						)}
					>
						<SelectTrigger class="w-full">
							<SelectValue<MediaDevice>>
								{(state) => state.selectedOption()?.label ?? "Default"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<div class="flex flex-col gap-1">
						<span class="text-xs text-muted-foreground">Input volume</span>
						<Slider
							value={[voicePrefs().inputVolume]}
							onChange={([v]) => updateVoice({ inputVolume: v })}
							minValue={0}
							maxValue={100}
						>
							<SliderTrack>
								<SliderFill />
								<SliderThumb />
							</SliderTrack>
						</Slider>
					</div>
				</div>
				{/* Output device */}
				<div class="flex flex-col gap-2">
					<label class="text-sm font-medium flex items-center gap-2">
						<SpeakerHighIcon />
						Speaker
					</label>
					<Select
						value={voicePrefs().outputDeviceId ?? "default"}
						onChange={(v) => updateVoice({ outputDeviceId: v })}
						options={[
							{ deviceId: "default", label: "Default" },
							...(devices()?.outputs ?? []),
						]}
						optionValue="deviceId"
						optionTextValue="label"
						itemComponent={(p) => (
							<SelectItem item={p.item}>{p.item.rawValue.label}</SelectItem>
						)}
					>
						<SelectTrigger class="w-full">
							<SelectValue<MediaDevice>>
								{(state) => state.selectedOption()?.label ?? "Default"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<div class="flex flex-col gap-1">
						<span class="text-xs text-muted-foreground">Output volume</span>
						<Slider
							value={[voicePrefs().outputVolume]}
							onChange={([v]) => updateVoice({ outputVolume: v })}
							minValue={0}
							maxValue={100}
						>
							<SliderTrack>
								<SliderFill />
								<SliderThumb />
							</SliderTrack>
						</Slider>
					</div>
				</div>
				{/* Noise suppression */}
				<ToggleSwitch
					checked={voicePrefs().noiseSuppressionEnabled}
					onChange={(v) => updateVoice({ noiseSuppressionEnabled: v })}
					class="flex items-center justify-between"
				>
					<SwitchLabel class="text-sm">Noise suppression</SwitchLabel>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</ToggleSwitch>
			</div>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Debug page
// ---------------------------------------------------------------------------

const DebugPage = () => {
	const user = useUserContext();

	return (
		<SettingsPage loading={() => false} title="Debug">
			<pre class="text-xs bg-muted rounded-sm p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">
				{JSON.stringify(
					{
						did: user.did,
						handle: user.handle,
						pdsHost: user.atproto.pdsHost,
						displayName: user.data.displayName,
						onlineState: user.data.onlineState,
					},
					null,
					2,
				)}
			</pre>
		</SettingsPage>
	);
};

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

type PageId = "profile" | "voice" | "debug";

const PAGES: Array<{ id: PageId; label: string; icon: typeof GearIcon }> = [
	{ id: "profile", label: "Profile", icon: UserIcon },
	{ id: "voice", label: "Voice & Audio", icon: MicrophoneIcon },
	{ id: "debug", label: "Debug", icon: BugIcon },
];

export const UserSettingsModal = (props: {
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
}) => {
	const [activePage, setActivePage] = createSignal<PageId>("profile");

	return (
		<Dialog open={props.open()} onOpenChange={props.setOpen}>
			<DialogPortal>
				<DialogContent class="w-[75vw] min-w-92 h-fit min-h-128 max-w-3xl! p-0 flex flex-row gap-0 max-h-[calc(100vh-4rem)]!">
					<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
						<DialogCloseButton class="absolute cursor-pointer">
							<XIcon />
						</DialogCloseButton>
					</div>
					{/* Sidebar nav */}
					<div class="min-h-128 h-auto flex flex-col p-4 min-w-52 border-r border-border">
						<div class="flex flex-col gap-1">
							<For each={PAGES}>
								{(page) => (
									<button
										type="button"
										class="w-full hover:bg-card px-2 py-1 rounded-sm cursor-pointer text-left flex flex-row items-center gap-2 text-sm"
										classList={{
											"bg-muted! text-foreground!":
												activePage() === page.id,
										}}
										onClick={() => setActivePage(page.id)}
									>
										<page.icon />
										{page.label}
									</button>
								)}
							</For>
						</div>
					</div>
					{/* Page content */}
					<Switch>
						<Match when={activePage() === "profile"}>
							<ProfilePage />
						</Match>
						<Match when={activePage() === "voice"}>
							<VoicePage />
						</Match>
						<Match when={activePage() === "debug"}>
							<DebugPage />
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

import type { JsonBlobRef } from "@atproto/lexicon";
import type { Details } from "@kobalte/core/file-field";
import { type Component, type JSX, Match, Show, Switch } from "solid-js";
import { putRecord, uploadBlob } from "../../../atproto/pds";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { useUserContext } from "../../../contexts/User";
import { Bluesky } from "../../icons/Bluesky";
import { Image } from "../../icons/Image";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
} from "../../ui/FileField";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "../../ui/TextField";
import {
	emptyThemeState,
	ThemeControls,
	type ThemeState,
	themeStateToRecord,
} from "../profile/theme";
import {
	type RecordBootstrapConfig,
	RecordBootstrapModal,
} from "./RecordBootstrapModal";

/** Field state collected by the profile setup flow. */
type ProfileFields = {
	displayName: string;
	description: string;
	/** Newly uploaded avatar/banner (takes precedence over the imported ref). */
	avatarFile?: Details;
	bannerFile?: Details;
	/** Blob refs carried over from an imported source (e.g. Bluesky). */
	avatarRef?: JsonBlobRef;
	bannerRef?: JsonBlobRef;
	theme: ThemeState;
};

const emptyFields = (): ProfileFields => ({
	displayName: "",
	description: "",
	theme: emptyThemeState(),
});

/** A small illustrative preview card for one of the two onboarding paths. */
const PreviewCard: Component<{ accent: boolean; icon: () => JSX.Element }> = (
	props,
) => (
	<div class="w-full rounded-md overflow-hidden border border-border bg-muted/20">
		<div
			class="h-8 w-full"
			classList={{
				"bg-primary/30": props.accent,
				"bg-muted/40": !props.accent,
			}}
		/>
		<div class="flex flex-col items-center -mt-4 pb-3 px-3 gap-2">
			<div
				class="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center"
				classList={{
					"bg-primary/40": props.accent,
					"bg-muted/60": !props.accent,
				}}
			>
				{props.icon()}
			</div>
			<div class="w-2/3 h-1.5 rounded-full bg-muted-foreground/30" />
			<div class="w-1/2 h-1.5 rounded-full bg-muted-foreground/20" />
		</div>
	</div>
);

/** The confirm/edit step. Mirrors the profile fields from the settings page. */
const ProfileFieldsForm: Component<{
	did: string;
	value: ProfileFields;
	setValue: (patch: Partial<ProfileFields>) => void;
	syncing: boolean;
}> = (props) => {
	const avatarUrl = () =>
		props.value.avatarFile === undefined
			? resolveBlob(props.did, props.value.avatarRef)
			: undefined;
	const bannerUrl = () =>
		props.value.bannerFile === undefined
			? resolveBlob(props.did, props.value.bannerRef)
			: undefined;

	return (
		<div class="w-full flex flex-col gap-4">
			<Show when={props.syncing}>
				<p class="text-sm text-muted-foreground m-0">
					Your name, avatar, banner and bio stay in sync with Bluesky and can't
					be edited here. You can still customize your Colibri appearance below.
				</p>
			</Show>

			<div class="w-full flex flex-col rounded-2xl border border-border bg-card overflow-hidden relative">
				{/* Banner */}
				<FileField
					class="items-start absolute w-full aspect-3/1 h-auto"
					onFileChange={(d) => props.setValue({ bannerFile: d })}
					maxFiles={1}
					disabled={props.syncing}
				>
					<FileFieldDropzone class="w-full h-full rounded-none border-none">
						<FileFieldTrigger class="h-full w-full p-0 bg-muted/25 hover:bg-muted/50 overflow-hidden rounded-none">
							<Switch>
								<Match when={props.value.bannerFile !== undefined}>
									<FileFieldItemList class="h-full w-full m-0 p-0">
										{() => (
											<FileFieldItem class="h-full w-full m-0 p-0 border-none block [&>div]:w-full [&>div]:h-full">
												<FileFieldItemPreviewImage class="h-full w-full aspect-3/1 self-center object-cover rounded-none" />
											</FileFieldItem>
										)}
									</FileFieldItemList>
								</Match>
								<Match when={bannerUrl() !== undefined}>
									<img
										src={bannerUrl()}
										alt="Banner"
										class="h-full w-full object-cover aspect-3/1"
									/>
								</Match>
								<Match when={true}>
									<div class="flex flex-col items-center justify-center gap-1">
										<Image className="w-6! h-6!" />
										<span>Upload banner</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>

				<div class="flex flex-col mt-32 p-4 gap-3">
					{/* Avatar */}
					<FileField
						class="items-start"
						onFileChange={(d) => props.setValue({ avatarFile: d })}
						maxFiles={1}
						disabled={props.syncing}
					>
						<FileFieldDropzone class="h-24 w-24 min-h-0 rounded-full">
							<FileFieldTrigger class="h-24 w-24 p-0 bg-muted/25 hover:bg-muted/50 rounded-full overflow-hidden">
								<Switch>
									<Match when={props.value.avatarFile !== undefined}>
										<FileFieldItemList class="w-24 h-24 m-0 p-0">
											{() => (
												<FileFieldItem class="w-24 h-24 m-0 p-0 border-none [&>div]:w-24">
													<FileFieldItemPreviewImage class="w-24 h-24 object-cover" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
									</Match>
									<Match when={avatarUrl() !== undefined}>
										<img
											src={avatarUrl()}
											alt="Avatar"
											class="w-24 h-24 object-cover"
										/>
									</Match>
									<Match when={true}>
										<div class="flex flex-col items-center justify-center gap-1">
											<Image className="w-6! h-6!" />
											<span>Upload</span>
										</div>
									</Match>
								</Switch>
							</FileFieldTrigger>
						</FileFieldDropzone>
						<FileFieldHiddenInput />
					</FileField>

					<TextField
						value={props.value.displayName}
						onChange={(v) => props.setValue({ displayName: v })}
					>
						<TextFieldLabel>Display Name</TextFieldLabel>
						<TextFieldInput
							maxLength={64}
							type="text"
							disabled={props.syncing}
							placeholder="Your name"
						/>
					</TextField>

					<TextField
						value={props.value.description}
						onChange={(v) => props.setValue({ description: v })}
					>
						<TextFieldLabel>Bio</TextFieldLabel>
						<TextFieldTextArea
							rows={4}
							maxLength={256}
							disabled={props.syncing}
							class="resize-none"
							placeholder="Tell others about yourself"
						/>
					</TextField>
				</div>
			</div>

			{/* Colibri-only theming */}
			<ThemeControls
				state={props.value.theme}
				setState={(patch) =>
					props.setValue({ theme: { ...props.value.theme, ...patch } })
				}
			/>
		</div>
	);
};

/**
 * First-login profile setup. Lets the user base their Colibri profile on their
 * Bluesky account (optionally kept in sync) or build one from scratch, then
 * writes a `social.colibri.actor.profile` record. Built on the reusable
 * {@link RecordBootstrapModal}.
 *
 * When the account has no Bluesky profile to import from (e.g. a brand-new
 * atproto account with no records), `hasBlueskyProfile` is false: the import
 * path is omitted entirely and the user goes straight to the from-scratch
 * editor.
 */
export const ProfileSetupModal: Component<{
	open: boolean;
	hasBlueskyProfile: boolean;
	onComplete: () => void;
}> = (props) => {
	const user = useUserContext();

	const config: RecordBootstrapConfig<ProfileFields> = {
		title: "Set up your profile",
		submitLabel: "Create profile",
		importSource: props.hasBlueskyProfile
			? {
					label: "Use my Bluesky profile",
					description: "Start from your existing Bluesky account data.",
					card: (
						<PreviewCard
							accent
							icon={() => <Bluesky className="w-4! h-4!" />}
						/>
					),
					supportsSync: true,
					syncLabel: "Keep in sync with Bluesky",
					syncDescription:
						"Automatically reflect changes you make to your Bluesky profile.",
					load: async () => {
						const fields = emptyFields();
						try {
							const res = await user.atproto.agent.com.atproto.repo.getRecord({
								repo: user.did,
								collection: "app.bsky.actor.profile",
								rkey: "self",
							});
							const value = res.data.value as Record<string, unknown>;
							fields.displayName = (value.displayName as string) ?? "";
							fields.description = (value.description as string) ?? "";
							fields.avatarRef = value.avatar as JsonBlobRef | undefined;
							fields.bannerRef = value.banner as JsonBlobRef | undefined;
						} catch {
							// No Bluesky profile — fall back to empty fields.
						}
						return fields;
					},
				}
			: undefined,
		scratch: {
			label: "Start from scratch",
			description: "Create a fresh Colibri profile. Nothing is required.",
			card: (
				<PreviewCard
					accent={false}
					icon={() => <Image className="w-4! h-4!" />}
				/>
			),
			initial: emptyFields,
		},
		renderFields: (p) => (
			<ProfileFieldsForm
				did={user.did}
				value={p.value}
				setValue={p.setValue}
				syncing={p.syncing}
			/>
		),
		submit: async (value, { sync }) => {
			const { agent } = user.atproto;
			const record: Record<string, unknown> = { syncBluesky: sync };

			const theme = themeStateToRecord(value.theme);
			if (theme) record.theme = theme;

			let avatar: JsonBlobRef | undefined;
			let banner: JsonBlobRef | undefined;

			// When syncing, the mirrored fields are served live from Bluesky, so
			// we omit them from the record entirely.
			if (!sync) {
				if (value.avatarFile) {
					avatar = (
						await uploadBlob(agent, value.avatarFile.acceptedFiles[0])
					).toJSON() as unknown as JsonBlobRef;
				} else if (value.avatarRef) {
					avatar = value.avatarRef;
				}
				if (value.bannerFile) {
					banner = (
						await uploadBlob(agent, value.bannerFile.acceptedFiles[0])
					).toJSON() as unknown as JsonBlobRef;
				} else if (value.bannerRef) {
					banner = value.bannerRef;
				}

				const displayName = value.displayName.trim();
				const description = value.description.trim();
				if (displayName) record.displayName = displayName;
				if (description) record.description = description;
				if (avatar) record.avatar = avatar;
				if (banner) record.banner = banner;
			}

			await putRecord(
				agent,
				user.did,
				"social.colibri.actor.profile",
				"self",
				record,
			);

			// Reflect the new profile locally without waiting for a refetch.
			user.updateActorData({
				syncBluesky: sync,
				theme,
				...(sync
					? {}
					: {
							displayName: value.displayName.trim() || user.data.displayName,
							description: value.description.trim(),
							avatar,
							banner,
						}),
			});

			props.onComplete();
		},
	};

	return (
		<RecordBootstrapModal
			config={config}
			open={props.open}
			dismissible={false}
		/>
	);
};

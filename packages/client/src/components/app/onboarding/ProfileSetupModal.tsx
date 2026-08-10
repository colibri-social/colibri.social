import type { JsonBlobRef } from "@atproto/lexicon";
import type { Details } from "@kobalte/core/file-field";
import {
	type Component,
	createMemo,
	type JSX,
	Match,
	onCleanup,
	Switch,
} from "solid-js";
import ArrowLineLeftIcon from "~icons/ph/arrow-line-left";
import InfoIcon from "~icons/ph/info";
import { putRecord, uploadBlob } from "../../../atproto/pds";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { endSession } from "../../../atproto/session";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { unregisterAllPush } from "../../../notifications";
import { getAppViewDid, getPreferredAppViewUrl } from "../../../utils/appview";
import { readableUserColor } from "../../../utils/readable-color";
import { resolvedTheme } from "../../../utils/theme";
import { Bluesky } from "../../icons/Bluesky";
import { Image } from "../../icons/Image";
import { Button } from "../../ui/Button";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
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

/**
 * Reactive object URL for an unsaved file, revoked as the file changes and on
 * unmount so blob URLs don't leak.
 */
const useObjectUrl = (
	file: () => Details | undefined,
): (() => string | undefined) => {
	const url = createMemo<string | undefined>((prev) => {
		if (prev) URL.revokeObjectURL(prev);
		const f = file()?.acceptedFiles[0];
		return f ? URL.createObjectURL(f) : undefined;
	});

	onCleanup(() => {
		const current = url();
		if (current) URL.revokeObjectURL(current);
	});

	return url;
};

/**
 * Renders a preview of a locally-selected file. Unlike Kobalte's
 * `FileFieldItemPreviewImage` (which reads the `FileField`'s internal
 * accepted-files state), this draws straight from the stored {@link Details},
 * so the preview survives remounts — e.g. stepping forward to the appearance
 * step and back.
 */
const LocalPreviewImage: Component<{
	file: Details;
	alt: string;
	class?: string;
}> = (props) => {
	const url = useObjectUrl(() => props.file);
	return <img src={url()} alt={props.alt} class={props.class} />;
};

/**
 * The editable profile card. It doubles as a live preview: the banner dropzone
 * shows the themed background (gradient or solid fallback color) behind any
 * uploaded image, and the display name is tinted with the accent color — so
 * editing the theme on the side updates this card in place.
 */
const ProfileFieldsForm: Component<{
	did: string;
	handle: string;
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

	// The themed banner background, sitting behind any uploaded image — mirrors
	// the real profile card's gradient → solid-color priority.
	const bannerStyle = (): JSX.CSSProperties => {
		const t = props.value.theme;
		if (t.useGradient)
			return {
				background: `linear-gradient(135deg, ${t.gradientPrimary}, ${t.gradientSecondary})`,
			};
		return { background: t.bannerColor };
	};

	return (
		<div class="w-full flex flex-col gap-4">
			<div
				class="w-full flex flex-col rounded-2xl border border-border bg-card overflow-hidden relative"
				classList={{
					"pointer-events-none opacity-50": props.syncing,
				}}
			>
				{/* Banner */}
				<FileField
					class="items-start absolute w-full aspect-3/1 h-auto"
					onFileChange={(d) => props.setValue({ bannerFile: d })}
					maxFiles={1}
				>
					<FileFieldDropzone class="w-full h-full rounded-none border-none min-h-none">
						<FileFieldTrigger
							class="h-full w-full p-0 overflow-hidden rounded-none transition hover:brightness-110"
							style={bannerStyle()}
						>
							<Switch>
								<Match when={props.value.bannerFile !== undefined}>
									<LocalPreviewImage
										file={props.value.bannerFile!}
										alt="Banner"
										class="h-full w-full object-cover aspect-3/1 rounded-none"
									/>
								</Match>
								<Match when={bannerUrl() !== undefined}>
									<img
										src={bannerUrl()}
										alt="Banner"
										class="h-full w-full object-cover aspect-3/1"
									/>
								</Match>
								<Match when={true}>
									<div class="flex flex-col items-center justify-center gap-1 text-white/90 drop-shadow">
										<Image className="w-6! h-6!" />
										<span>Upload banner</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>

				<div class="flex flex-col mt-8.5 p-4 gap-3">
					{/* Avatar */}
					<FileField
						class="items-start w-fit z-40 rounded-full"
						onFileChange={(d) => props.setValue({ avatarFile: d })}
						maxFiles={1}
					>
						<FileFieldDropzone class="h-24 w-24 min-h-0 rounded-full">
							<FileFieldTrigger class="h-24 w-24 p-0 bg-muted/25 hover:bg-muted/50 rounded-full overflow-hidden">
								<Switch>
									<Match when={props.value.avatarFile !== undefined}>
										<LocalPreviewImage
											file={props.value.avatarFile!}
											alt="Avatar"
											class="w-24 h-24 object-cover"
										/>
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
							placeholder={props.handle.replaceAll("at://", "")}
							class="font-bold"
							style={{
								color: readableUserColor(
									props.value.theme.accentColor,
									resolvedTheme(),
								),
							}}
						/>
					</TextField>

					<TextField
						value={props.value.description}
						onChange={(v) => props.setValue({ description: v })}
					>
						<TextFieldLabel>Bio</TextFieldLabel>
						<TextFieldTextArea
							rows={9}
							maxLength={256}
							class="resize-none"
							placeholder="Tell others about yourself"
						/>
					</TextField>
				</div>
			</div>
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
	returning: boolean;
	onComplete: () => void;
}> = (props) => {
	const user = useUserContext();
	const auth = useAuthContext();
	const userPreferences = useUserPreferences();

	const logout = async () => {
		try {
			await unregisterAllPush((endpoint, provider) =>
				user.xrpc.social.colibri.notification.unregisterPush(
					endpoint,
					provider,
				),
			);
			await auth?.client.revoke(user.did);
		} finally {
			await endSession();
		}
	};

	const config: RecordBootstrapConfig<ProfileFields> = {
		title: "Set up your profile",
		submitLabel: "Create profile",
		notice: props.returning ? (
			<div class="flex flex-row items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
				<InfoIcon class="mt-0.5 shrink-0 text-primary" />
				<p class="m-0">
					<strong class="text-foreground">Welcome back!</strong> Your
					communities, messages, and account are safe. Colibri now uses its own
					profile, separate from Bluesky. Set it up below to pick up where you
					left off. You can import your Bluesky profile or start fresh.
				</p>
			</div>
		) : undefined,
		footerStart: (
			<Button variant="ghost" onClick={logout}>
				<ArrowLineLeftIcon />
				Log out
			</Button>
		),
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
					defaultSync: true,
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
			<div class="w-full flex flex-col sm:flex-row gap-6">
				<div class="sm:w-1/2">
					<ProfileFieldsForm
						did={user.did}
						handle={user.handle.replaceAll("at://", "")}
						value={p.value}
						setValue={p.setValue}
						syncing={p.syncing}
					/>
				</div>
				<div class="sm:w-1/2 flex flex-col gap-2">
					<h3 class="m-0 text-base font-semibold">Appearance</h3>
					<ThemeControls
						state={p.value.theme}
						setState={(patch) =>
							p.setValue({ theme: { ...p.value.theme, ...patch } })
						}
					/>
				</div>
			</div>
		),
		submit: async (value, { sync }) => {
			const { agent } = user.atproto;
			const record: Record<string, unknown> = { syncBluesky: sync };

			const theme = themeStateToRecord(value.theme);
			record.theme = theme;

			if (userPreferences.preferences().sharePresence) {
				record.presenceService = getAppViewDid(getPreferredAppViewUrl());
			}

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

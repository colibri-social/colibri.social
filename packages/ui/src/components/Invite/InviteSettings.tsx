import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { RefreshIcon } from "@solar-icons/solid/bold/refresh";
import { createSignal, createUniqueId, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import {
	InviteLinkPanel,
	type InviteLinkPanelProps,
} from "../CopyField/CopyField";
import { Modal, ModalContent } from "../Modal/Modal";
import { Select } from "../Select/Select";
import {
	DEFAULT_INVITE_SETTINGS,
	INVITE_EXPIRY_OPTIONS,
	INVITE_MAX_USES_OPTIONS,
	type InviteExpiry,
	type InviteMaxUses,
	type InviteRequest,
	type InviteSettingsValue,
	inviteRequestFrom,
} from "./invite-settings";

export type InviteSettingsPlatform = "mobile" | "desktop";

export type InviteSettingsFormProps = {
	platform?: InviteSettingsPlatform;
	value: InviteSettingsValue;
	onChange: (value: InviteSettingsValue) => void;
	onGenerate: () => void;
	generating?: boolean;
	error?: JSX.Element;
	id?: string;
	class?: string;
};

export const InviteSettingsForm = (props: InviteSettingsFormProps) => {
	const noteId = createUniqueId();
	return (
		<div
			id={props.id}
			data-invite-settings=""
			class={cx("flex flex-col gap-4", props.class)}
		>
			<div class="flex flex-col gap-4 md:flex-row md:[&>*]:min-w-0 md:[&>*]:flex-1">
				<Select
					platform={props.platform}
					label="Expires after"
					options={INVITE_EXPIRY_OPTIONS}
					value={props.value.expiry}
					disabled={props.generating}
					onChange={(expiry) =>
						props.onChange({ ...props.value, expiry: expiry as InviteExpiry })
					}
				/>
				<Select
					platform={props.platform}
					label="Max uses"
					options={INVITE_MAX_USES_OPTIONS}
					value={props.value.maxUses}
					disabled={props.generating}
					onChange={(maxUses) =>
						props.onChange({
							...props.value,
							maxUses: maxUses as InviteMaxUses,
						})
					}
				/>
			</div>
			<p id={noteId} class="m-0 text-sm text-pretty text-muted-foreground">
				Invite links can't be changed once they exist, so this creates a new
				link with these settings.
			</p>
			<Show when={props.error}>
				<div
					role="alert"
					data-invite-settings-error=""
					class="flex items-start gap-2 rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					<DangerCircleIcon class="mt-px size-4 shrink-0" aria-hidden="true" />
					<span class="min-w-0 flex-1 text-pretty">{props.error}</span>
				</div>
			</Show>
			<Button
				block
				icon={<RefreshIcon />}
				loading={props.generating}
				aria-describedby={noteId}
				onClick={() => props.onGenerate()}
			>
				Create new link
			</Button>
		</div>
	);
};

export type InviteLinkShareProps = Omit<
	InviteLinkPanelProps,
	"onSettings" | "settingsExpanded" | "settingsControls"
> & {
	platform?: InviteSettingsPlatform;
	settings?: InviteSettingsValue;
	defaultSettings?: InviteSettingsValue;
	onSettingsChange?: (value: InviteSettingsValue) => void;
	onGenerate: (request: InviteRequest) => Promise<void> | void;
	generateErrorMessage?: string;
};

export const InviteLinkShare = (props: InviteLinkShareProps) => {
	const platform = () => props.platform ?? "mobile";
	const settingsId = createUniqueId();
	let root: HTMLDivElement | undefined;
	const [open, setOpen] = createSignal(false);
	const [generating, setGenerating] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const [announcement, setAnnouncement] = createSignal("");
	const [localSettings, setLocalSettings] = createSignal<InviteSettingsValue>(
		props.defaultSettings ?? DEFAULT_INVITE_SETTINGS,
	);
	const settings = () => props.settings ?? localSettings();

	const changeSettings = (value: InviteSettingsValue) => {
		setLocalSettings(value);
		setError(undefined);
		props.onSettingsChange?.(value);
	};

	const generate = async () => {
		if (generating()) return;
		setGenerating(true);
		setError(undefined);
		setAnnouncement("");
		try {
			await props.onGenerate(inviteRequestFrom(settings()));
			setOpen(false);
			setAnnouncement("New invite link created");
		} catch {
			setError(
				props.generateErrorMessage ??
					"The invite link couldn't be created. Try again.",
			);
		} finally {
			setGenerating(false);
		}
	};

	const toggle = () => {
		setError(undefined);
		setOpen((value) => !value);
	};

	const form = () => (
		<InviteSettingsForm
			id={settingsId}
			platform={platform()}
			value={settings()}
			onChange={changeSettings}
			onGenerate={() => void generate()}
			generating={generating()}
			error={error()}
		/>
	);

	return (
		<div
			ref={root}
			data-invite-link-share=""
			class={cx("flex flex-col gap-4", props.class)}
		>
			<InviteLinkPanel
				url={props.url}
				title={props.title}
				shareText={props.shareText}
				onShare={props.onShare}
				onCopy={props.onCopy}
				shareLabel={props.shareLabel}
				settingsLabel={props.settingsLabel}
				onSettings={toggle}
				settingsExpanded={platform() === "mobile" ? open() : undefined}
				settingsControls={
					platform() === "mobile" && open() ? settingsId : undefined
				}
			/>
			<Show
				when={platform() === "mobile"}
				fallback={
					<Modal open={open()} onOpenChange={setOpen}>
						<ModalContent
							title="Invite settings"
							description="Choose how long the new link works and how often it can be used."
							class="md:w-[440px]"
							onCloseAutoFocus={(event) => {
								const trigger = root?.querySelector<HTMLElement>(
									"[data-invite-settings-trigger]",
								);
								if (!trigger) return;
								event.preventDefault();
								trigger.focus();
							}}
						>
							{form()}
						</ModalContent>
					</Modal>
				}
			>
				<Show when={open()}>
					<section
						aria-label="Invite settings"
						class="flex flex-col gap-4 border-t border-border pt-4"
					>
						{form()}
					</section>
				</Show>
			</Show>
			<span role="status" aria-live="polite" class="sr-only">
				{announcement()}
			</span>
		</div>
	);
};

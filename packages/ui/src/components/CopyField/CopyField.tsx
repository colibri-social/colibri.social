import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { ShareIcon } from "@solar-icons/solid/bold/share";
import { createSignal, type JSX, onCleanup, Show } from "solid-js";
import { AnimatedCopyIcon } from "../../icons/animated/icons";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { TextField } from "../TextField/TextField";

const COPIED_MS = 1500;

export type ShareData = { title?: string; text?: string; url: string };

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export const shareOrCopy = async (
	data: ShareData,
	anchor?: HTMLElement,
): Promise<ShareResult> => {
	if (
		typeof navigator !== "undefined" &&
		typeof navigator.share === "function" &&
		(typeof navigator.canShare !== "function" || navigator.canShare(data))
	) {
		try {
			await navigator.share(data);
			return "shared";
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError")
				return "cancelled";
		}
	}
	return (await copyText(data.url, anchor)) ? "copied" : "failed";
};

const createCopiedFlag = () => {
	const [copied, setCopied] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timer));
	return {
		copied,
		mark: () => {
			clearTimeout(timer);
			setCopied(true);
			timer = setTimeout(() => setCopied(false), COPIED_MS);
		},
	};
};

export type CopyFieldProps = {
	value: string;
	label?: JSX.Element;
	"aria-label"?: string;
	copyLabel?: string;
	copiedMessage?: string;
	onCopy?: (value: string) => void;
	class?: string;
};

export const CopyField = (props: CopyFieldProps) => {
	const flag = createCopiedFlag();

	const copy = async (anchor: HTMLElement) => {
		if (!(await copyText(props.value, anchor))) return;
		flag.mark();
		props.onCopy?.(props.value);
	};

	return (
		<div data-copy-field="" class={cx("flex w-full flex-col", props.class)}>
			<TextField
				readOnly
				value={props.value}
				label={props.label}
				aria-label={props["aria-label"] ?? (props.label ? undefined : "Link")}
				class="select-text"
				ref={(input) => {
					const selectAll = () => input.select();
					input.addEventListener("focus", selectAll);
					input.addEventListener("click", selectAll);
				}}
				trailingAction={
					<IconButton
						variant="primary"
						size="lg"
						label={flag.copied() ? "Copied" : (props.copyLabel ?? "Copy link")}
						data-copied={flag.copied() || undefined}
						icon={<AnimatedCopyIcon copied={flag.copied()} />}
						onClick={(event) => void copy(event.currentTarget)}
					/>
				}
			/>
			<span role="status" aria-live="polite" class="sr-only">
				{flag.copied() ? (props.copiedMessage ?? "Link copied") : ""}
			</span>
		</div>
	);
};

export type InviteLinkPanelProps = {
	url: string;
	title?: string;
	shareText?: string;
	onShare?: (data: ShareData) => Promise<ShareResult> | ShareResult;
	onSettings?: () => void;
	settingsExpanded?: boolean;
	settingsControls?: string;
	onCopy?: (value: string) => void;
	shareLabel?: string;
	settingsLabel?: string;
	class?: string;
};

export const InviteLinkPanel = (props: InviteLinkPanelProps) => {
	const flag = createCopiedFlag();

	const share = async (anchor: HTMLElement) => {
		const data = { title: props.title, text: props.shareText, url: props.url };
		const result = props.onShare
			? await props.onShare(data)
			: await shareOrCopy(data, anchor);
		if (result === "copied") {
			flag.mark();
			props.onCopy?.(props.url);
		}
	};

	return (
		<div
			data-invite-link-panel=""
			class={cx("flex w-full flex-col gap-4", props.class)}
		>
			<CopyField
				value={props.url}
				aria-label="Invite link"
				copyLabel="Copy invite link"
				copiedMessage="Invite link copied"
				onCopy={props.onCopy}
			/>
			<div class="flex w-full gap-2">
				<Button
					variant="secondary"
					class="h-9 min-w-0 flex-1 px-3"
					icon={<ShareIcon />}
					onClick={(event) => void share(event.currentTarget)}
				>
					<span class="truncate">
						{flag.copied()
							? "Link copied"
							: (props.shareLabel ?? "Share invite")}
					</span>
				</Button>
				<Show when={props.onSettings}>
					<Button
						variant="secondary"
						class="h-9 min-w-0 flex-1 px-3"
						icon={<SettingsIcon />}
						aria-expanded={props.settingsExpanded}
						aria-controls={props.settingsControls}
						data-invite-settings-trigger=""
						onClick={() => props.onSettings?.()}
					>
						<span class="truncate">
							{props.settingsLabel ?? "Invite settings"}
						</span>
					</Button>
				</Show>
			</div>
			<span role="status" aria-live="polite" class="sr-only">
				{flag.copied()
					? "Sharing isn't available, so the invite link was copied"
					: ""}
			</span>
		</div>
	);
};

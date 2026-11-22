import { CloudStorageIcon } from "@solar-icons/solid/bold/cloud-storage";
import { CloudUploadIcon } from "@solar-icons/solid/bold/cloud-upload";
import { createUniqueId, Show } from "solid-js";
import { cx } from "../../utils/cx";

export type StorageNoticeState = "hosted" | "moving";

export type StorageNoticeProgress = { done: number; total: number };

export type StorageNoticeProps = {
	state: StorageNoticeState;
	progress?: StorageNoticeProgress;
	class?: string;
};

export const STORAGE_NOTICE_COPY = {
	hosted: {
		title: "Colibri is keeping your messages for you",
		description:
			"Your account's provider can't store them yet. Once it can, they'll move over on their own, and you don't need to do anything.",
	},
	moving: {
		title: "Moving your messages to your provider",
		description:
			"This happens in the background. You can keep using Colibri as usual.",
	},
	progressLabel: "Move progress",
} as const;

export const storageNoticePercent = (progress?: StorageNoticeProgress) => {
	if (!progress || progress.total <= 0) return 0;

	const ratio = Math.min(Math.max(progress.done / progress.total, 0), 1);

	return Math.round(ratio * 100);
};

export const StorageNotice = (props: StorageNoticeProps) => {
	const titleId = createUniqueId();
	const copy = () => STORAGE_NOTICE_COPY[props.state];
	const moving = () => props.state === "moving";
	const percent = () => storageNoticePercent(props.progress);

	return (
		<section
			data-storage-notice={props.state}
			role="status"
			aria-labelledby={titleId}
			class={cx(
				"flex w-full min-w-0 items-start gap-3 rounded-surface bg-secondary p-3 text-sm",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				class="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground [&>svg]:size-4"
			>
				{moving() ? <CloudUploadIcon /> : <CloudStorageIcon />}
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<p id={titleId} class="m-0 font-semibold text-pretty text-foreground">
					{copy().title}
				</p>
				<p class="m-0 text-pretty text-muted-foreground">
					{copy().description}
				</p>
				<Show when={moving()}>
					<div class="mt-1 flex min-w-0 items-center gap-2">
						<div
							role="progressbar"
							aria-label={STORAGE_NOTICE_COPY.progressLabel}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={percent()}
							class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-background"
						>
							<div
								data-storage-progress=""
								class="h-full rounded-full bg-primary transition-[width] duration-[calc(240ms*var(--motion-scale))] motion-reduce:transition-none reduced-motion:transition-none"
								style={{ width: `${percent()}%` }}
							/>
						</div>
						<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
							{percent()}%
						</span>
					</div>
				</Show>
			</div>
		</section>
	);
};

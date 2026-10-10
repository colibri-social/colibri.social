import { CloseIcon } from "@solar-icons/solid/bold/close";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { FileIcon } from "@solar-icons/solid/bold/file";
import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";

export type PendingAttachment = {
	id: string;
	name: string;
	size?: number;
	previewSrc?: string;
	progress?: number;
	failed?: boolean;
};

export type AttachmentTrayProps = {
	items: PendingAttachment[];
	max?: number;
	onRemove?: (id: string) => void;
	class?: string;
};

const RING_RADIUS = 9;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const formatFileSize = (bytes: number) => {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

const extensionOf = (name: string) => {
	const dot = name.lastIndexOf(".");
	return dot > 0 && dot < name.length - 1
		? name.slice(dot + 1, dot + 5).toUpperCase()
		: undefined;
};

const UploadProgress = (props: { progress: number }) => (
	<span
		role="progressbar"
		aria-label="Uploading"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(props.progress * 100)}
		class="absolute inset-0 flex items-center justify-center bg-background/60"
	>
		<svg viewBox="0 0 20 20" class="size-6 -rotate-90" aria-hidden="true">
			<circle
				cx="10"
				cy="10"
				r={RING_RADIUS}
				fill="none"
				stroke-width="2"
				data-upload-track=""
				class="stroke-foreground/25"
			/>
			<circle
				cx="10"
				cy="10"
				r={RING_RADIUS}
				fill="none"
				stroke-width="2"
				data-upload-arc=""
				stroke-linecap="round"
				stroke-dasharray={`${RING_CIRCUMFERENCE}`}
				stroke-dashoffset={`${RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, props.progress)))}`}
				class="stroke-foreground transition-[stroke-dashoffset] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)] motion-reduce:transition-none reduced-motion:transition-none"
			/>
		</svg>
	</span>
);

export const AttachmentTray = (props: AttachmentTrayProps) => (
	<Show when={props.items.length > 0}>
		<div
			data-attachment-tray=""
			class={cx("flex flex-col gap-2 border-b border-border p-2", props.class)}
		>
			<Show when={props.max}>
				{(max) => (
					<span class="px-1 text-xs text-muted-foreground tabular-nums">
						{props.items.length}/{max()} attachments
					</span>
				)}
			</Show>
			<ul class="-mx-1 -mt-1 -mb-1 flex list-none gap-2 overflow-x-auto p-1 pt-2.5 pr-2.5">
				<For each={props.items}>
					{(item) => (
						<li
							class="relative shrink-0"
							title={
								item.size === undefined
									? item.name
									: `${item.name}, ${formatFileSize(item.size)}`
							}
						>
							<div
								class={cx(
									"relative size-14 overflow-hidden rounded-control border bg-secondary",
									item.failed ? "border-destructive" : "border-border",
								)}
							>
								<Show
									when={item.previewSrc}
									fallback={
										<span class="flex size-full flex-col items-center justify-center gap-0.5 text-muted-foreground">
											<FileIcon class="size-5" />
											<Show when={extensionOf(item.name)}>
												{(extension) => (
													<span class="text-xs leading-none font-semibold">
														{extension()}
													</span>
												)}
											</Show>
										</span>
									}
								>
									{(src) => (
										<AnimatedImage
											src={src()}
											alt={item.name}
											class="size-full object-cover"
										/>
									)}
								</Show>
								<Show
									when={
										!item.failed &&
										item.progress !== undefined &&
										item.progress < 1
									}
								>
									<UploadProgress progress={item.progress ?? 0} />
								</Show>
								<Show when={item.failed}>
									<span
										role="img"
										aria-label="Upload failed"
										class="absolute inset-0 flex items-center justify-center bg-background/60 text-destructive"
									>
										<DangerTriangleIcon class="size-5" />
									</span>
								</Show>
							</div>
							<button
								type="button"
								aria-label={`Remove ${item.name}`}
								onClick={() => props.onRemove?.(item.id)}
								class={cx(
									"focus-ring absolute -top-1.5 -right-1.5 flex size-6 cursor-pointer items-center justify-center rounded-control-xs border border-border bg-popover text-muted-foreground",
									"transition-colors duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)] hover:bg-secondary-highlight hover:text-foreground",
								)}
							>
								<CloseIcon class="size-3.5" />
							</button>
						</li>
					)}
				</For>
			</ul>
		</div>
	</Show>
);

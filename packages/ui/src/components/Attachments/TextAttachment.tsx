import { DownloadMinimalisticIcon } from "@solar-icons/solid/bold/download-minimalistic";
import { FullScreenIcon } from "@solar-icons/solid/bold/full-screen";
import { createSignal, onCleanup, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { IconButton } from "../IconButton/IconButton";
import { SkeletonText } from "../Skeleton/Skeleton";
import { TableText } from "../Table/TableText";
import { FileAttachment } from "./FileAttachment";
import { embedSurface, formatBytes, SpoilerFrame } from "./shared";
import { TextAttachmentViewer } from "./TextAttachmentViewer";

export type TextAttachmentFormat = "text" | "markdown";

export type TextAttachmentProps = {
	name: string;
	size: number;
	text?: string;
	format?: TextAttachmentFormat;
	mimeType?: string;
	failed?: boolean;
	spoiler?: boolean;
	onDownload?: () => void;
	class?: string;
};

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);

export const textAttachmentFormatOf = (
	name: string,
	mimeType?: string,
): TextAttachmentFormat | undefined => {
	const extension = name.split(".").pop()?.toLowerCase() ?? "";
	const type = mimeType?.split(";")[0]?.trim().toLowerCase();

	if (type === "text/markdown" || MARKDOWN_EXTENSIONS.has(extension)) {
		return "markdown";
	}

	if (type === "text/plain" || extension === "txt") return "text";

	return undefined;
};

const FORMAT_LABEL: Record<TextAttachmentFormat, string> = {
	text: "Text",
	markdown: "Markdown",
};

const actionClass = "shrink-0 text-muted-foreground hover:text-foreground";

export const TextAttachment = (props: TextAttachmentProps) => {
	const [revealed, setRevealed] = createSignal(false);
	const [viewing, setViewing] = createSignal(false);
	const [clamped, setClamped] = createSignal(false);
	const hidden = () => !!props.spoiler && !revealed();
	const format = () =>
		props.format ??
		textAttachmentFormatOf(props.name, props.mimeType) ??
		"text";
	const meta = () => `${FORMAT_LABEL[format()]} · ${formatBytes(props.size)}`;

	const observe = (element: HTMLPreElement) => {
		const measure = () =>
			setClamped(element.scrollHeight > element.clientHeight + 1);
		const observer = new ResizeObserver(measure);

		observer.observe(element);
		onCleanup(() => observer.disconnect());
	};

	const card = () => (
		<div
			data-text-attachment=""
			class={cx(
				embedSurface,
				"flex w-full max-w-[416px] flex-col overflow-hidden",
				!props.spoiler && props.class,
			)}
		>
			<div class="flex items-center gap-2 py-2 pr-2 pl-3">
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<TableText class="text-sm font-semibold" text={props.name} />
					<span class="text-xs text-muted-foreground">{meta()}</span>
				</span>
				<IconButton
					variant="ghost"
					size="md"
					label={`Expand ${props.name}`}
					icon={<FullScreenIcon />}
					disabled={props.text === undefined}
					onClick={() => setViewing(true)}
					class={actionClass}
				/>
				<Show when={props.onDownload}>
					<IconButton
						variant="ghost"
						size="md"
						label={`Download ${props.name}`}
						icon={<DownloadMinimalisticIcon />}
						onClick={() => props.onDownload?.()}
						class={actionClass}
					/>
				</Show>
			</div>
			<Show
				when={props.text !== undefined}
				fallback={
					<div
						data-text-attachment-loading=""
						aria-busy="true"
						class="flex flex-col gap-2 border-t border-border px-3 py-3"
					>
						<SkeletonText size="xs" width="90%" />
						<SkeletonText size="xs" width="75%" />
						<SkeletonText size="xs" width="60%" />
					</div>
				}
			>
				<pre
					ref={observe}
					data-text-attachment-body=""
					data-layout-clip=""
					data-clamped={clamped() ? "" : undefined}
					class={cx(
						"m-0 max-h-40 overflow-hidden border-t border-border px-3 py-2.5",
						"font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground/90",
						"data-clamped:[mask-image:linear-gradient(to_bottom,black_60%,transparent)]",
					)}
				>
					{props.text}
				</pre>
			</Show>
		</div>
	);

	const preview = () => (
		<Show when={props.spoiler} fallback={card()}>
			<SpoilerFrame
				hidden={hidden()}
				label="Reveal spoiler file"
				onReveal={() => setRevealed(true)}
				class={props.class}
			>
				{card()}
			</SpoilerFrame>
		</Show>
	);

	return (
		<Show
			when={!props.failed}
			fallback={
				<FileAttachment
					name={props.name}
					size={props.size}
					mimeType={props.mimeType}
					spoiler={props.spoiler}
					onDownload={props.onDownload}
					class={props.class}
				/>
			}
		>
			{preview()}
			<Show when={props.text !== undefined}>
				<TextAttachmentViewer
					open={viewing()}
					onOpenChange={setViewing}
					name={props.name}
					text={props.text ?? ""}
					onDownload={props.onDownload}
				/>
			</Show>
		</Show>
	);
};

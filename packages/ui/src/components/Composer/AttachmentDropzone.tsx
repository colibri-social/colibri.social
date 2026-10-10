import { CloudUploadIcon } from "@solar-icons/solid/bold/cloud-upload";
import {
	createEffect,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";

export type AttachmentDropzoneProps = {
	onFiles: (files: File[]) => void;
	channelName?: string;
	disabled?: boolean;
	footer?: JSX.Element;
	children?: JSX.Element;
	class?: string;
};

const draggingFiles = (event: DragEvent) =>
	Array.from(event.dataTransfer?.types ?? []).includes("Files");

const channelLabel = (name: string) =>
	name.startsWith("#") ? name : `#${name}`;

export const AttachmentDropzone = (props: AttachmentDropzoneProps) => {
	const footer = createSlot(() => props.footer);
	const [active, setActive] = createSignal(false);
	let root: HTMLDivElement | undefined;
	let depth = 0;

	const reset = () => {
		depth = 0;
		setActive(false);
	};

	createEffect(() => {
		if (props.disabled) reset();
	});

	const handleEnter = (event: DragEvent) => {
		if (props.disabled || !draggingFiles(event)) return;
		depth += 1;
		setActive(true);
	};

	const handleLeave = (event: DragEvent) => {
		if (!draggingFiles(event) || depth === 0) return;
		depth -= 1;
		if (depth === 0) setActive(false);
	};

	const handleOver = (event: DragEvent) => {
		if (props.disabled || !draggingFiles(event)) return;
		event.preventDefault();
		if (!event.dataTransfer) return;
		const inside =
			event.target instanceof Node && !!root?.contains(event.target);
		event.dataTransfer.dropEffect = inside ? "copy" : "none";
	};

	const handleWindowDrop = (event: DragEvent) => {
		if (draggingFiles(event)) event.preventDefault();
		reset();
	};

	const handleDrop = (event: DragEvent) => {
		if (props.disabled || !draggingFiles(event)) return;
		event.preventDefault();
		const files = Array.from(event.dataTransfer?.files ?? []);
		reset();
		if (files.length > 0) props.onFiles(files);
	};

	onMount(() => {
		window.addEventListener("dragenter", handleEnter);
		window.addEventListener("dragleave", handleLeave);
		window.addEventListener("dragover", handleOver);
		window.addEventListener("drop", handleWindowDrop);
		window.addEventListener("dragend", reset);
		onCleanup(() => {
			window.removeEventListener("dragenter", handleEnter);
			window.removeEventListener("dragleave", handleLeave);
			window.removeEventListener("dragover", handleOver);
			window.removeEventListener("drop", handleWindowDrop);
			window.removeEventListener("dragend", reset);
		});
	});

	return (
		<div
			ref={root}
			data-attachment-dropzone=""
			data-active={active() || undefined}
			class={cx("flex min-h-0 min-w-0 flex-1 flex-col", props.class)}
			onDrop={handleDrop}
		>
			<div
				data-attachment-dropzone-area=""
				class="relative flex min-h-0 min-w-0 flex-1 flex-col"
			>
				{props.children}
				<div
					data-attachment-dropzone-overlay=""
					data-visible={active() || undefined}
					aria-hidden={active() ? undefined : "true"}
					class={cx(
						"pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-surface border-2 border-dashed border-primary-highlight bg-card/90 p-6 backdrop-blur-sm",
						"transition-[opacity,scale] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)]",
						"motion-reduce:transition-none reduced-motion:transition-none",
						"not-data-[visible]:scale-[0.98] not-data-[visible]:opacity-0",
					)}
				>
					<div class="flex max-w-sm flex-col items-center gap-3 text-center">
						<span
							aria-hidden="true"
							class="flex size-14 items-center justify-center rounded-full bg-primary-fill text-primary-foreground [&_svg]:size-7"
						>
							<CloudUploadIcon />
						</span>
						<p class="m-0 text-base font-semibold text-foreground">
							Drop files to attach
						</p>
						<Show when={props.channelName}>
							{(name) => (
								<p class="m-0 text-sm text-muted-foreground">
									Upload to {channelLabel(name())}
								</p>
							)}
						</Show>
					</div>
				</div>
				<span role="status" class="sr-only">
					{active() ? "Drop files to attach" : ""}
				</span>
			</div>
			<Show when={footer.has()}>{footer()}</Show>
		</div>
	);
};

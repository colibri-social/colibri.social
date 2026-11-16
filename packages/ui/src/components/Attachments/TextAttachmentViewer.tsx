import { parseMarkdown } from "@colibri-social/lib";
import { DownloadMinimalisticIcon } from "@solar-icons/solid/bold/download-minimalistic";
import { createMemo, Show } from "solid-js";
import { MARKDOWN_LINK_POLICY } from "../../utils/rich-text/link-safety";
import { IconButton } from "../IconButton/IconButton";
import { LargeModalContent, Modal } from "../Modal/Modal";
import { RichTextRenderer } from "../RichText/RichText";

export type TextAttachmentViewerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	text: string;
	onDownload?: () => void;
};

export const TextAttachmentViewer = (props: TextAttachmentViewerProps) => {
	const parsed = createMemo(() => {
		return parseMarkdown(props.text, [], {
			...MARKDOWN_LINK_POLICY,
			autolink: true,
		});
	});

	return (
		<Modal open={props.open} onOpenChange={props.onOpenChange}>
			<LargeModalContent
				title={props.name}
				actions={
					<Show when={props.onDownload}>
						<IconButton
							variant="ghost"
							size="md"
							label={`Download ${props.name}`}
							icon={<DownloadMinimalisticIcon />}
							onClick={() => props.onDownload?.()}
						/>
					</Show>
				}
			>
				<section
					data-text-attachment-viewer=""
					aria-label={props.name}
					// biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users scroll the file contents
					tabIndex={0}
					class="focus-ring-inset -m-4 h-[calc(100%+2rem)] overflow-y-auto p-4 outline-none"
				>
					<RichTextRenderer
						value={parsed()}
						jumbo={false}
						class="text-base leading-prose break-words"
					/>
				</section>
			</LargeModalContent>
		</Modal>
	);
};

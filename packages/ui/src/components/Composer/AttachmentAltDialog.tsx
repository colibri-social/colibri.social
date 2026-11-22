import { createEffect, createSignal, on, Show } from "solid-js";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Button } from "../Button/Button";
import { Modal, ModalContent } from "../Modal/Modal";
import { TextArea } from "../TextField/TextField";

export const ALT_TEXT_MAX = 2000;

export const ALT_TEXT_COPY = {
	title: "Add alt text",
	editTitle: "Edit alt text",
	description: "Describe what's in this image for people who can't see it.",
	label: "Alt text",
	placeholder: "A short description of the image",
	save: "Save",
	cancel: "Cancel",
} as const;

export type AttachmentAltDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	previewSrc?: string;
	value?: string;
	onSave: (alt: string) => void;
};

export const AttachmentAltDialog = (props: AttachmentAltDialogProps) => {
	const [draft, setDraft] = createSignal(props.value ?? "");
	createEffect(
		on(
			() => props.open,
			(open) => {
				if (open) setDraft(props.value ?? "");
			},
		),
	);
	const initial = () => props.value ?? "";
	const save = () => {
		props.onSave(draft().trim());
		props.onOpenChange(false);
	};

	return (
		<Modal
			open={props.open}
			onOpenChange={props.onOpenChange}
			dirty={draft().trim() !== initial()}
		>
			<ModalContent
				title={initial() ? ALT_TEXT_COPY.editTitle : ALT_TEXT_COPY.title}
				description={ALT_TEXT_COPY.description}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => props.onOpenChange(false)}
						>
							{ALT_TEXT_COPY.cancel}
						</Button>
						<Button
							variant="primary"
							disabled={draft().trim() === initial()}
							onClick={save}
						>
							{ALT_TEXT_COPY.save}
						</Button>
					</>
				}
			>
				<div data-attachment-alt-dialog="" class="flex flex-col gap-4">
					<Show when={props.previewSrc}>
						{(src) => (
							<div class="flex max-h-72 min-h-0 justify-center overflow-hidden rounded-control bg-secondary">
								<AnimatedImage
									src={src()}
									alt=""
									class="max-h-72 w-auto max-w-full object-contain"
								/>
							</div>
						)}
					</Show>
					<TextArea
						label={ALT_TEXT_COPY.label}
						placeholder={ALT_TEXT_COPY.placeholder}
						value={draft()}
						onChange={setDraft}
						rows={3}
						autoResize
						maxLength={ALT_TEXT_MAX}
						showCount
					/>
				</div>
			</ModalContent>
		</Modal>
	);
};

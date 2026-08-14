import type { Component } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import { BottomSheet } from "../../../../ui/MenuDrawer";
import {
	EmbedsDialogBody,
	EmbedsDialogCancelButton,
	EmbedsDialogDescriptionContent,
	EmbedsDialogSaveButton,
	EmbedsDialogTitleContent,
} from "./shared";

export const Mobile: Component = () => {
	const { embedsModalOpen, closeEmbedsModal } = useMessageContext();

	return (
		<BottomSheet
			open={embedsModalOpen()}
			onOpenChange={(open) => {
				if (!open) closeEmbedsModal();
			}}
		>
			<div class="flex flex-col gap-1.5 p-4">
				<h2 class="m-0 text-foreground font-semibold">
					<EmbedsDialogTitleContent />
				</h2>
				<p class="m-0 text-sm text-muted-foreground">
					<EmbedsDialogDescriptionContent />
				</p>
			</div>
			<EmbedsDialogBody />
			<div class="mt-auto flex flex-col gap-2 p-4 pb-[calc(1rem+var(--safe-area-bottom))]">
				<EmbedsDialogSaveButton />
				<EmbedsDialogCancelButton />
			</div>
		</BottomSheet>
	);
};

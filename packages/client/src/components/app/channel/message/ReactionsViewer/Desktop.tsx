import { type Component, Show } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../../../ui/Dialog";
import { ReactionTabs, ReactorRows, useActiveReaction } from "./shared";

export const Desktop: Component = () => {
	const { reactionsViewerOpen, closeReactionsViewer } = useMessageContext();
	const active = useActiveReaction();

	return (
		<Dialog
			open={reactionsViewerOpen()}
			onOpenChange={(open) => {
				if (!open) closeReactionsViewer();
			}}
		>
			<DialogPortal>
				<DialogContent class="gap-0 overflow-y-hidden p-0 sm:max-w-xl">
					<DialogHeader class="p-4 pr-12">
						<DialogTitle class="m-0">Reactions</DialogTitle>
					</DialogHeader>
					<Show when={active()}>
						{(reaction) => (
							<div class="flex h-96 min-h-0 flex-row border-t border-border">
								<div class="flex w-28 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-2">
									<ReactionTabs orientation="vertical" />
								</div>
								<div class="min-w-0 flex-1 overflow-y-auto p-2">
									<ReactorRows reaction={reaction()} />
								</div>
							</div>
						)}
					</Show>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

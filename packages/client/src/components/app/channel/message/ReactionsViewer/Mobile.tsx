import { type Component, Show } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import { BottomSheet } from "../../../../ui/MenuDrawer";
import { ReactionTabs, ReactorRows, useActiveReaction } from "./shared";

export const Mobile: Component = () => {
	const { reactionsViewerOpen, closeReactionsViewer } = useMessageContext();
	const active = useActiveReaction();

	return (
		<BottomSheet
			open={reactionsViewerOpen()}
			onOpenChange={(open) => {
				if (!open) closeReactionsViewer();
			}}
		>
			<div class="flex shrink-0 flex-col gap-1.5 px-4 pt-2 pb-3">
				<h2 class="m-0 font-semibold text-foreground">Reactions</h2>
			</div>
			<Show when={active()}>
				{(reaction) => (
					<>
						<div class="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border px-2">
							<ReactionTabs orientation="horizontal" />
						</div>
						<div class="h-[55dvh] min-h-0 shrink overflow-y-auto px-2 pt-2 pb-[calc(1rem+var(--safe-area-bottom))]">
							<ReactorRows reaction={reaction()} />
						</div>
					</>
				)}
			</Show>
		</BottomSheet>
	);
};

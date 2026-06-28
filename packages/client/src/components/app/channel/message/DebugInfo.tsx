import { type Component, Show } from "solid-js";
import XIcon from "~icons/ph/x";
import { useMessageContext } from "../../../../contexts/Message";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
} from "../../../ui/Dialog";
import { BottomSheet } from "../../../ui/MenuDrawer";
import { SettingsInfoPage } from "../../common/SettingsInfoPage";
import { useIsMobile } from "../../../../utils/mobile-pane";

export const DebugInfo: Component = () => {
	const { message, debugModalOpen, setDebugModalOpen } = useMessageContext();
	const isMobile = useIsMobile();

	return (
		<Show
			when={isMobile()}
			fallback={
				<Dialog open={debugModalOpen()} onOpenChange={setDebugModalOpen}>
					<DialogPortal>
						<DialogContent class="w-[75vw] min-w-92 h-fit min-h-108 max-w-lg! p-0 flex flex-row gap-0">
							<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
								<DialogCloseButton
									class="absolute cursor-pointer"
									onClick={() => setDebugModalOpen(false)}
								>
									<XIcon />
								</DialogCloseButton>
							</div>
							<SettingsInfoPage uri={message.uri} />
						</DialogContent>
					</DialogPortal>
				</Dialog>
			}
		>
			<BottomSheet open={debugModalOpen()} onOpenChange={setDebugModalOpen}>
				<div class="overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					<SettingsInfoPage uri={message.uri} />
				</div>
			</BottomSheet>
		</Show>
	);
};

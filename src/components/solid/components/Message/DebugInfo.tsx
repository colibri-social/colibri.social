import type { Component, Setter } from "solid-js";
import { Icon } from "@/components/solid/icons/Icon";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import type { DBMessageData } from "@/utils/sdk";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
} from "../../shadcn-solid/Dialog";
import { SettingsInfoPage } from "../SettingsInfoPage";

export const DebugInfo: Component<{
	open: boolean;
	setOpen: Setter<boolean>;
	message: DBMessageData;
}> = (props) => {
	return (
		<Dialog open={props.open} onOpenChange={props.setOpen}>
			<DialogPortal>
				<DialogContent class="w-[75vw] min-w-92 h-fit min-h-108 max-w-lg! p-0 flex flex-row gap-0">
					<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
						<DialogCloseButton
							class="absolute cursor-pointer"
							onClick={() => props.setOpen(false)}
						>
							<Icon variant="regular" name="x-icon" />
						</DialogCloseButton>
					</div>
					<SettingsInfoPage
						did={props.message.author_did}
						collection={RECORD_IDs.MESSAGE}
						rkey={props.message.rkey}
					/>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

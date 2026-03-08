import { type ParentComponent, type Setter, Show } from "solid-js";
import createMediaQuery from "@/utils/create-media-query";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../contexts/GlobalContext";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../shadcn-solid/Dialog";
import { MobileDrawer } from "./MobileDeletionDrawer";
import { MockMessage } from "./MockMessage";
import {
	DialogCancelButton,
	DialogConfirmButton,
	DialogDescriptionContent,
	DialogTip,
	DialogTitleContent,
	deleteMessage,
} from "./util";

/**
 * The message deletion drawer used as a warning when a message is about to be deleted.
 */
export const MessageDeletionDrawer: ParentComponent<{
	message: DBMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	open: boolean;
	setOpen: Setter<boolean>;
}> = (props) => {
	const isDesktop = createMediaQuery("(min-width: 768px)");

	return (
		<Show
			when={isDesktop()}
			fallback={
				<MobileDrawer
					message={props.message}
					addDeletedMessage={props.addDeletedMessage}
					open={props.open}
					isDesktop={isDesktop}
					setOpen={props.setOpen}
				/>
			}
		>
			<Dialog open={props.open}>
				<DialogTrigger class="w-full">{props.children}</DialogTrigger>
				<DialogPortal>
					<DialogContent>
						<DialogHeader>
							<DialogTitle class="m-0">
								<DialogTitleContent />
							</DialogTitle>
							<DialogDescription class="m-0">
								<DialogDescriptionContent />
							</DialogDescription>
						</DialogHeader>
						<MockMessage
							message={props.message as DBMessageData}
							isDesktop={isDesktop}
						/>
						<DialogTip />
						<DialogFooter>
							<DialogCancelButton setOpen={props.setOpen} />
							<DialogConfirmButton
								onClick={() => {
									deleteMessage(
										props.message as IndexedMessageData,
										props.addDeletedMessage,
										props.setOpen,
									);
								}}
							/>
						</DialogFooter>
					</DialogContent>
				</DialogPortal>
			</Dialog>
		</Show>
	);
};

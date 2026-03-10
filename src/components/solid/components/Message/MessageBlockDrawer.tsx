import {
	type Component,
	type JSX,
	type ParentComponent,
	type Setter,
	Show,
} from "solid-js";
import createMediaQuery from "@/utils/create-media-query";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../contexts/GlobalContext";
import { Button } from "../../shadcn-solid/Button";
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
import { MobileDrawer } from "./MobileBlockDrawer";
import { MockMessage } from "./MockMessage";
import { blockMessage, DialogCancelButton, DialogTip } from "./util";

/**
 * The header content used in both the mobile and desktop block dialog.
 */
export const BlockDialogTitleContent: Component = () => "Block this message?";

/**
 * The description content used in both the mobile and block dialog.
 */
export const BlockDialogDescriptionContent: Component = () =>
	"This will block the message for all Colibri users, hiding it. The original data source will not be deleted. This action cannot be undone.";

/**
 * The confirmation button used in both the mobile and desktop block dialog.
 */
export const BlockDialogConfirmButton: Component<{
	onClick: JSX.EventHandlerUnion<
		HTMLButtonElement,
		MouseEvent,
		JSX.EventHandler<HTMLButtonElement, MouseEvent>
	>;
}> = (props) => (
	<Button variant="destructive" class="cursor-pointer" onClick={props.onClick}>
		Block message
	</Button>
);

/**
 * The message black drawer used as a warning when a message is about to be blocked by an admin.
 */
export const MessageBlockDrawer: ParentComponent<{
	message: DBMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	open: boolean;
	setOpen: Setter<boolean>;
	community: string;
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
					community={props.community}
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
								<BlockDialogTitleContent />
							</DialogTitle>
							<DialogDescription class="m-0">
								<BlockDialogDescriptionContent />
							</DialogDescription>
						</DialogHeader>
						<MockMessage
							message={props.message as DBMessageData}
							isDesktop={isDesktop}
						/>
						<DialogTip />
						<DialogFooter>
							<DialogCancelButton setOpen={props.setOpen} />
							<BlockDialogConfirmButton
								onClick={() => {
									blockMessage(
										props.message as IndexedMessageData,
										props.addDeletedMessage,
										props.community,
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

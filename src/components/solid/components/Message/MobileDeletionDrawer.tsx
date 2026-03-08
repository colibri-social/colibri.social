import type { Accessor, ParentComponent, Setter } from "solid-js";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../contexts/GlobalContext";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
	DrawerTrigger,
} from "../../shadcn-solid/Drawer";
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
 * The mobile version of the message deletion drawer used as a warning when a message is about to be deleted.
 */
export const MobileDrawer: ParentComponent<{
	open: boolean;
	setOpen: Setter<boolean>;
	message: DBMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	isDesktop: Accessor<boolean>;
}> = (props) => (
	<Drawer breakPoints={[0.75]} open={props.open}>
		<DrawerTrigger>{props.children}</DrawerTrigger>
		<DrawerPortal>
			<DrawerContent>
				<DrawerHeader>
					<DrawerLabel class="m-0">
						<DialogTitleContent />
					</DrawerLabel>
					<DrawerDescription class="m-0">
						<DialogDescriptionContent />
					</DrawerDescription>
				</DrawerHeader>
				<MockMessage
					isDesktop={props.isDesktop}
					message={props.message as DBMessageData}
				/>
				<DialogTip />
				<DrawerFooter>
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
				</DrawerFooter>
			</DrawerContent>
		</DrawerPortal>
	</Drawer>
);

import { type ParentComponent, type Setter, Show } from "solid-js";
import createMediaQuery from "@/utils/create-media-query";
import type { DBMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../../contexts/GlobalContext";
import { Mobile } from "./Mobile";
import { Desktop } from "./Desktop";

/**
 * The message deletion drawer used as a warning when a message is about to be deleted.
 */
export const DeletionDrawer: ParentComponent<{
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
				<Mobile
					message={props.message}
					addDeletedMessage={props.addDeletedMessage}
					open={props.open}
					setOpen={props.setOpen}
				/>
			}
		>
			<Desktop
				message={props.message}
				addDeletedMessage={props.addDeletedMessage}
				open={props.open}
				setOpen={props.setOpen}
			/>
		</Show>
	);
};

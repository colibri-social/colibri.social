import { type ParentComponent, type Setter, Show } from "solid-js";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "@/components/solid/contexts/GlobalContext";
import createMediaQuery from "@/utils/create-media-query";
import type { DBMessageData } from "@/utils/sdk";
import { Desktop } from "./Desktop";
import { Mobile } from "./Mobile";

export const BlockDrawer: ParentComponent<{
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
				<Mobile
					message={props.message}
					addDeletedMessage={props.addDeletedMessage}
					open={props.open}
					community={props.community}
					setOpen={props.setOpen}
				/>
			}
		>
			<Desktop
				message={props.message}
				addDeletedMessage={props.addDeletedMessage}
				open={props.open}
				community={props.community}
				setOpen={props.setOpen}
			/>
		</Show>
	);
};

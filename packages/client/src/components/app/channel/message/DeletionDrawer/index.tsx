import { type ParentComponent, Show } from "solid-js";
import { Desktop } from "./Desktop";
import { Mobile } from "./Mobile";
import createMediaQuery from "../../../../../utils/create-media-query";

/**
 * The message deletion drawer used as a warning when a message is about to be deleted.
 */
export const DeletionDrawer: ParentComponent = (props) => {
	const isDesktop = createMediaQuery("(min-width: 768px)");

	return (
		<Show when={isDesktop()} fallback={<Mobile>{props.children}</Mobile>}>
			<Desktop>{props.children}</Desktop>
		</Show>
	);
};

import { type ParentComponent, Show } from "solid-js";
import { Desktop } from "./Desktop";
import { Mobile } from "./Mobile";
import createMediaQuery from "../../../../../utils/create-media-query";

export const BlockDrawer: ParentComponent = (props) => {
	const isDesktop = createMediaQuery("(min-width: 768px)");

	return (
		<Show when={isDesktop()} fallback={<Mobile>{props.children}</Mobile>}>
			<Desktop>{props.children}</Desktop>
		</Show>
	);
};

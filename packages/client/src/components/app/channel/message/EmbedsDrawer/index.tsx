import { type Component, Show } from "solid-js";
import createMediaQuery from "../../../../../utils/create-media-query";
import { Desktop } from "./Desktop";
import { Mobile } from "./Mobile";

export const EmbedsDrawer: Component = () => {
	const isDesktop = createMediaQuery("(min-width: 768px)");

	return (
		<Show when={isDesktop()} fallback={<Mobile />}>
			<Desktop />
		</Show>
	);
};

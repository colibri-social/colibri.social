import { DeveloperModeCard } from "@colibri-social/ui";
import { createEffect, onCleanup, Show } from "solid-js";
import { usePlatform } from "../../screen/platform";
import { type DeveloperTarget, useModalPage } from "./desktop/page-header";

export const AdminDeveloper = (props: { target?: DeveloperTarget }) => {
	const page = useModalPage();
	if (page) {
		createEffect(() => page.developer(props.target));
		onCleanup(() => page.developer(undefined));
		return null;
	}
	const platform = usePlatform();
	return (
		<Show when={props.target}>
			{(target) => (
				<DeveloperModeCard
					stacked={platform() === "desktop"}
					copyLabel="Copy AT-URI"
					copyValue={target().copyValue}
					pdslsHref={target().pdslsHref}
				/>
			)}
		</Show>
	);
};

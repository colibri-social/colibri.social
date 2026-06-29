import type { Accessor, Component } from "solid-js";
import { For, Show } from "solid-js";
import { useCommunityContext } from "../../../../contexts/Community";
import { cx } from "../../../../utils/cva";
import { renderWithFacets, type TextWithFacets } from "./util";

/**
 * A rich text renderer component that parses a given text and renders its facets as HTML.
 * Can be made editable using the `editable` prop.
 */
export const RichTextRenderer: Component<{
	text: Accessor<TextWithFacets>;
	classList?: Record<string, boolean>;
	id?: string;
	class?: string;
	isEdited?: boolean;
}> = (props) => {
	const community = useCommunityContext();

	const rendered = renderWithFacets(props.text(), community().community.uri);

	return (
		<div
			class={cx(
				"m-0 text-foreground rich-text focus:outline-0 leading-7 break-after-auto relative min-w-0 [overflow-wrap:anywhere]",
				props.class,
			)}
			classList={props.classList}
			id={props.id}
		>
			<For each={rendered}>{(component) => component}</For>
			<Show when={props.isEdited}>
				<span
					class="text-muted-foreground text-xs inline"
					classList={{ "ml-1": rendered.length === 1 }}
				>
					{" "}
					(edited)
				</span>
			</Show>
		</div>
	);
};

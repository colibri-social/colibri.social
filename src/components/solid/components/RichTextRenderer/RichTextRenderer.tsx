import type { Accessor, Component } from "solid-js";
import { For, Show } from "solid-js";
import { cn } from "@/utils/cn";
import { useChannelContext } from "../../contexts/ChannelContext";
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
	const channelCtx = useChannelContext();

	const community = (): string => {
		return channelCtx?.community() ?? "";
	};

	const rendered = renderWithFacets(props.text(), community());

	return (
		<p
			class={cn(
				"m-0 text-foreground rich-text focus:outline-0 leading-7 wrap-break-word relative",
				props.class,
			)}
			classList={props.classList}
			id={props.id}
		>
			<For each={rendered}>{(component) => component}</For>
			<Show when={props.isEdited}>
				<span class="text-muted-foreground text-xs inline"> (edited)</span>
			</Show>
		</p>
	);
};

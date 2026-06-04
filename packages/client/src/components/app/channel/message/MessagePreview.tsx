import type { Component } from "solid-js";
import type { Message } from "../../../../atproto/xrpc/social/colibri/channel/listMessages";
import User from "../../user";
import { RichTextRenderer } from "../../common/rich-text-renderer/RichTextRenderer";
import type { TextWithFacets } from "../../common/rich-text-renderer/util";

/**
 * Read-only, non-interactive message preview used inside Block/Deletion
 * drawers. Intentionally does not render any drawers, context menus, or
 * action buttons — breaking the recursion that would occur if a full
 * <Message> were rendered inside its own modal.
 */
export const MessagePreview: Component<{ data: Message }> = (props) => {
	const text = (): TextWithFacets => ({
		text: props.data.text,
		facets: props.data.facets || [],
	});

	return (
		<div class="w-full h-fit flex flex-row gap-4 pr-4 pl-3.5 py-1 bg-card/50 rounded-sm border border-border">
			<User.Avatar user={props.data.author} />
			<div class="flex flex-col w-full justify-center gap-0.5">
				<div class="flex gap-2 text-sm items-baseline">
					<span class="font-bold">
						<User.DisplayableName user={props.data.author} />
					</span>
					<small class="text-muted-foreground">
						{new Date(props.data.createdAt).toLocaleDateString()}{" "}
						{new Date(props.data.createdAt).toLocaleTimeString(undefined, {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</small>
				</div>
				<RichTextRenderer text={text} />
			</div>
		</div>
	);
};

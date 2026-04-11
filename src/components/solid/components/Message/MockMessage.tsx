import type { Component } from "solid-js";
import createMediaQuery from "@/utils/create-media-query";
import type { DBMessageData } from "@/utils/sdk";
import { RichTextRenderer } from "../RichTextRenderer";
import User from "../User";
import { MessageAttachments } from "./Attachments";

/**
 * A mock render of a message shown in the deletion modal when a message is about to be deleted.
 * TODO(refactor): Just use the normal message component once refactored and simplified
 */
export const MockMessage: Component<{
	message: DBMessageData;
}> = (props) => {
	const isDesktop = createMediaQuery("(min-width: 768px)");

	return (
		<div
			class={`w-full h-fit flex flex-row p-2 gap-4 group relative border border-border rounded-sm`}
			classList={{
				"mx-4": !isDesktop(),
				"w-full mx-0": isDesktop(),
			}}
		>
			<User.Avatar
				user={{
					avatar_url: props.message.avatar_url,
					display_name: props.message.display_name,
				}}
			/>
			<div class="flex flex-col w-full justify-center">
				<div class="flex gap-2 text-sm items-baseline">
					<span class="font-bold">{props.message.display_name}</span>
					<small class="text-muted-foreground">
						{new Date(props.message.created_at).toLocaleDateString()}{" "}
						{new Date(props.message.created_at).toLocaleTimeString(undefined, {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</small>
				</div>
				<RichTextRenderer
					text={() => ({
						text: props.message.text,
						facets: props.message.facets || [],
					})}
				/>
				<div classList={{ "mt-2": props.message.text.trim().length === 0 }}>
					<MessageAttachments
						did={props.message.author_did}
						attachments={props.message.attachments || []}
						disableHover
					/>
				</div>
			</div>
		</div>
	);
};

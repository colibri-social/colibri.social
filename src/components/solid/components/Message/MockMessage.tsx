import type { Accessor, Component } from "solid-js";
import type { DBMessageData } from "@/utils/sdk";
import type { PendingMessageData } from "../../contexts/GlobalContext";
import { RichTextRenderer } from "../RichTextRenderer";

/**
 * A mock render of a message shown in the deletion modal when a message is about to be deleted.
 */
export const MockMessage: Component<{
	message: DBMessageData | PendingMessageData;
	isDesktop: Accessor<boolean>;
}> = (props) => {
	const isPending = () => "hash" in props.message;
	return (
		<div
			class={`w-fullh-fit flex flex-row p-2 gap-4 group relative border border-border rounded-sm`}
			classList={{
				"mx-4": !props.isDesktop(),
				"w-full mx-0": props.isDesktop(),
			}}
		>
			<img
				src={props.message.avatar_url || "/user-placeholder.png"}
				alt={props.message.display_name}
				class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
				loading="lazy"
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
					classList={{
						"text-muted-foreground": isPending(),
						"text-foreground": !isPending(),
					}}
				/>
			</div>
		</div>
	);
};

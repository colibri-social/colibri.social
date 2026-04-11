import type { Component, JSX } from "solid-js";
import { Button } from "../../../shadcn-solid/Button";

/**
 * The header content used in both the mobile and desktop block dialog.
 */
export const BlockDialogTitleContent: Component = () => "Block this message?";

/**
 * The description content used in both the mobile and block dialog.
 */
export const BlockDialogDescriptionContent: Component = () =>
	"This will block the message for all Colibri users, hiding it. The original data source will not be deleted. This action cannot be undone.";

/**
 * The confirmation button used in both the mobile and desktop block dialog.
 */
export const BlockDialogConfirmButton: Component<{
	onClick: JSX.EventHandlerUnion<
		HTMLButtonElement,
		MouseEvent,
		JSX.EventHandler<HTMLButtonElement, MouseEvent>
	>;
}> = (props) => (
	<Button variant="destructive" class="cursor-pointer" onClick={props.onClick}>
		Block message
	</Button>
);

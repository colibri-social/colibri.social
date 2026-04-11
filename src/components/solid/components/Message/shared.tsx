import type { Component, JSX, Setter } from "solid-js";
import { DialogCloseButton } from "../../shadcn-solid/Dialog";
import { Button } from "../../shadcn-solid/Button";

/**
 * The dialog tip used in both the mobile and desktop deletion dialog.
 */
export const DialogTip: Component = () => (
	<p class="text-sm text-muted-foreground my-1">
		Tip: You can shift-click the button to skip this pop-up!
	</p>
);

/**
 * The confirmation button used in both the mobile and desktop deletion dialog.
 */
export const DialogConfirmButton: Component<{
	onClick: JSX.EventHandlerUnion<
		HTMLButtonElement,
		MouseEvent,
		JSX.EventHandler<HTMLButtonElement, MouseEvent>
	>;
}> = (props) => (
	<Button variant="destructive" class="cursor-pointer" onClick={props.onClick}>
		Delete message
	</Button>
);

/**
 * The cancellation button used in both the mobile and desktop deletion dialog.
 */
export const DialogCancelButton: Component<{ setOpen: Setter<boolean> }> = (
	props,
) => (
	<DialogCloseButton>
		<Button
			variant="secondary"
			class="cursor-pointer"
			onClick={() => props.setOpen(false)}
		>
			Cancel
		</Button>
	</DialogCloseButton>
);

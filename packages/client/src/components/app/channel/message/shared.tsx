import type { Component, JSX, Setter } from "solid-js";
import { Button } from "../../../ui/Button";
import { DialogCloseButton } from "../../../ui/Dialog";

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
 * The cancellation button used in the desktop deletion/block dialog. Relies on
 * Kobalte's `DialogCloseButton`, which requires an ancestor `Dialog` context —
 * use `MobileCancelButton` inside the mobile `BottomSheet`, which has no such
 * context.
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

/**
 * The cancellation button used in the mobile deletion/block bottom sheet.
 */
export const MobileCancelButton: Component<{ setOpen: Setter<boolean> }> = (
	props,
) => (
	<Button
		variant="secondary"
		class="cursor-pointer"
		onClick={() => props.setOpen(false)}
	>
		Cancel
	</Button>
);

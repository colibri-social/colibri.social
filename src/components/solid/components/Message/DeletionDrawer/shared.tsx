import type { Component, JSX, Setter } from "solid-js";
import { Button } from "../../../shadcn-solid/Button";
import { DialogCloseButton } from "@/components/solid/shadcn-solid/Dialog";

/**
 * The header content used in both the mobile and desktop deletion dialog.
 */
export const DialogTitleContent: Component = () => "Delete this message?";

/**
 * The description content used in both the mobile and desktop deletion dialog.
 */
export const DialogDescriptionContent: Component = () =>
	"This action cannot be undone.";

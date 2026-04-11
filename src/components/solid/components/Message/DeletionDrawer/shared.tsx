import type { Component } from "solid-js";

/**
 * The header content used in both the mobile and desktop deletion dialog.
 */
export const DialogTitleContent: Component = () => "Delete this message?";

/**
 * The description content used in both the mobile and desktop deletion dialog.
 */
export const DialogDescriptionContent: Component = () =>
	"This action cannot be undone.";

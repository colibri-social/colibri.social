import type { HiddenMessageChoice } from "@colibri-social/ui";
import type { CommunityView } from "../types";

export const canSeeHiddenMessages = (space: CommunityView | undefined) =>
	!!space?.viewer?.isOwner ||
	!!space?.viewer?.permissions?.includes("label.apply");

export const hiddenMessageChoiceOf = (
	override: boolean | undefined,
): HiddenMessageChoice =>
	override === undefined ? "default" : override ? "hide" : "show";

export const hiddenMessageOverrideOf = (
	choice: HiddenMessageChoice,
): boolean | undefined =>
	choice === "default" ? undefined : choice === "hide";

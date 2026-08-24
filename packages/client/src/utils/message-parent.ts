import type { MessageParent } from "../atproto/views";
import { isVisibleParent, MESSAGE_VIEW_TYPE } from "../atproto/views";

export type ParentAvailability = "visible" | "unavailable";

export const parentAvailability = (
	parent: MessageParent,
): ParentAvailability => (isVisibleParent(parent) ? "visible" : "unavailable");

export const isKnownParentType = (parent: MessageParent): boolean =>
	parent.$type === MESSAGE_VIEW_TYPE ||
	parent.$type === "social.colibri.beta.channel.defs#deletedMessageView";

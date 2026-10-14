import { onCleanup } from "solid-js";
import type { LeaveSource } from "./leave-guard";
import { useStack } from "./stack";

export const useUnsavedChanges = (changes: LeaveSource) => {
	const stack = useStack();
	onCleanup(stack.registerLeave(changes));
};

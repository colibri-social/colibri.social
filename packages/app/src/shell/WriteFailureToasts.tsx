import { toast } from "@colibri-social/ui";
import { onCleanup } from "solid-js";
import { useData, type WriteFailure } from "../data/store";

export const WRITE_FAILURE_COPY: Record<
	WriteFailure["kind"],
	{ title: string; description: string }
> = {
	edit: {
		title: "Your edit wasn't saved",
		description: "The message is back to how it was. Try editing it again.",
	},
	delete: {
		title: "The message wasn't deleted",
		description: "It's back in the channel. Try deleting it again.",
	},
	react: {
		title: "Your reaction didn't go through",
		description: "Try reacting again in a moment.",
	},
};

export const WriteFailureToasts = () => {
	const data = useData();
	onCleanup(
		data.onWriteFailed((failure) => {
			const copy = WRITE_FAILURE_COPY[failure.kind];
			toast.error(copy.title, { description: copy.description });
		}),
	);
	return null;
};

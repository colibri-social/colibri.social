import type { ColibriErrorCode } from "@colibri-social/lib";
import { toast } from "@colibri-social/ui";
import { onCleanup } from "solid-js";
import { copyForCode } from "../data/error-copy";
import { useData, type WriteFailure } from "../data/store";

type WriteFailureCopy = { title: string; description: string };

export const WRITE_FAILURE_COPY: Record<
	WriteFailure["kind"],
	WriteFailureCopy
> = {
	send: {
		title: "Your message wasn't sent",
		description: "Try sending it again.",
	},
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

const CODE_SPECIFIC_FAILURES = new Set<string>(["ServerFileTooLarge"]);

export const writeFailureCopy = (failure: WriteFailure): WriteFailureCopy => {
	if (!CODE_SPECIFIC_FAILURES.has(failure.code))
		return WRITE_FAILURE_COPY[failure.kind];

	const copy = copyForCode(failure.code as ColibriErrorCode);

	return {
		title: copy.title,
		description:
			copy.description ?? WRITE_FAILURE_COPY[failure.kind].description,
	};
};

export const WriteFailureToasts = () => {
	const data = useData();

	onCleanup(
		data.onWriteFailed((failure) => {
			const copy = writeFailureCopy(failure);

			toast.error(copy.title, { description: copy.description });
		}),
	);

	return null;
};

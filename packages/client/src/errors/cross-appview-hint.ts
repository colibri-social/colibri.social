import { toast } from "somoto";

type HintHandlers = {
	enablePresenceSharing: () => void | Promise<void>;
	suppressPermanently: () => void;
	isSuppressed: () => boolean;
};

let handlers: HintHandlers | undefined;
let shownThisSession = false;

export const setCrossAppViewHintHandlers = (next: HintHandlers): void => {
	handlers = next;
};

export const resetCrossAppViewHint = (): void => {
	shownThisSession = false;
};

export const showCrossAppViewHint = (): boolean => {
	if (!handlers || handlers.isSuppressed() || shownThisSession) return false;
	shownThisSession = true;

	const id = toast.error("Turn on presence sharing to moderate here.", {
		duration: 15_000,
		description:
			"This community is hosted on another AppView. Publishing which AppView you use lets it accept your moderation actions.",
		action: {
			label: "Turn on",
			onClick: () => {
				toast.dismiss(id);
				void handlers?.enablePresenceSharing();
			},
		},
		cancel: {
			label: "Don't show again",
			onClick: () => {
				toast.dismiss(id);
				handlers?.suppressPermanently();
			},
		},
	});

	return true;
};

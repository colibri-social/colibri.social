import { WhatsNewDialog } from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import { releaseNoteView } from "../data/release-note-views";
import {
	APP_RELEASE_NOTES,
	currentReleasePlatform,
	type ReleaseNoteSummary,
	releaseNotesFor,
} from "../data/release-notes";
import { markReleaseNoteSeen, pendingReleaseNote } from "../data/whats-new";
import { usePlatform } from "../screen/platform";
import { queueBlockingDialog } from "./blocking-dialogs";
import type { Navigator } from "./stack";

export const WhatsNewHost = (props: {
	stack: Pick<Navigator, "push" | "top">;
	notes?: readonly ReleaseNoteSummary[];
}) => {
	const platform = usePlatform();
	const newest = (props.notes ??
		releaseNotesFor(APP_RELEASE_NOTES, currentReleasePlatform()))[0];
	const [pending, setPending] = createSignal(!!pendingReleaseNote(newest));
	const joining = () => {
		return props.stack.top()?.kind === "join";
	};
	const turn = queueBlockingDialog(() => pending() && !joining());

	const dismiss = () => {
		if (!newest || !pending()) return;
		markReleaseNoteSeen(newest.version);
		setPending(false);
	};

	const openAll = () => {
		dismiss();
		props.stack.push({ kind: "settings", page: "whatsNew" });
	};

	return (
		<Show when={newest}>
			{(note) => (
				<WhatsNewDialog
					open={turn()}
					onOpenChange={(next) => {
						if (!next) dismiss();
					}}
					note={releaseNoteView(note())}
					platform={platform()}
					onOpenAll={openAll}
				/>
			)}
		</Show>
	);
};

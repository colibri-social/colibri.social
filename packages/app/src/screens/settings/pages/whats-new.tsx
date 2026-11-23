import { RELEASE_HISTORY_URL, WhatsNewSettings } from "@colibri-social/ui";
import { releaseNoteView } from "../../../data/release-note-views";
import {
	APP_RELEASE_NOTES,
	currentReleasePlatform,
	type ReleaseNoteSummary,
	releaseNotesFor,
} from "../../../data/release-notes";
import type { Platform } from "../../../screen/platform";

export default function WhatsNewPage(props: {
	platform: Platform;
	notes?: readonly ReleaseNoteSummary[];
}) {
	const notes = () =>
		(
			props.notes ??
			releaseNotesFor(APP_RELEASE_NOTES, currentReleasePlatform())
		).map(releaseNoteView);
	return <WhatsNewSettings notes={notes()} historyHref={RELEASE_HISTORY_URL} />;
}

import { RELEASE_HISTORY_URL, WhatsNewSettings } from "@colibri-social/ui";
import { BugIcon } from "@solar-icons/solid/bold/bug";
import { Stars2Icon } from "@solar-icons/solid/bold/stars-2";
import {
	APP_RELEASE_NOTES,
	currentReleasePlatform,
	releaseNotesFor,
} from "../../../data/release-notes";
import type { Platform } from "../../../screen/platform";

export default function WhatsNewPage(_props: { platform: Platform }) {
	const notes = () =>
		releaseNotesFor(APP_RELEASE_NOTES, currentReleasePlatform()).map(
			(note) => ({
				...note,
				items: note.entries.map((entry) => ({
					title: entry.title,
					body: <>{entry.body}</>,
					kind: entry.kind,
					icon: entry.kind === "fix" ? <BugIcon /> : <Stars2Icon />,
				})),
			}),
		);
	return <WhatsNewSettings notes={notes()} historyHref={RELEASE_HISTORY_URL} />;
}

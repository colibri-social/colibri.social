import type { ReleaseNoteView } from "@colibri-social/ui";
import { Dynamic } from "solid-js/web";
import type { ReleaseNoteSummary } from "./release-notes";
import {
	FALLBACK_RELEASE_NOTE_ICON,
	RELEASE_NOTE_ICONS,
	type ReleaseNoteIcon,
} from "./release-notes/icons";

const iconComponent = (icon: string) => {
	const name = Object.hasOwn(RELEASE_NOTE_ICONS, icon)
		? (icon as ReleaseNoteIcon)
		: FALLBACK_RELEASE_NOTE_ICON;

	return RELEASE_NOTE_ICONS[name];
};

export const releaseNoteView = (note: ReleaseNoteSummary): ReleaseNoteView => {
	return {
		...note,
		items: note.entries.map((entry) => ({
			title: entry.title,
			body: <>{entry.body}</>,
			kind: entry.kind,
			icon: <Dynamic component={iconComponent(entry.icon)} />,
		})),
	};
};

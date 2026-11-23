import { clearToasts, setAppActive } from "@colibri-social/ui";
import { beforeEach } from "vitest";
import { clearAttachmentDrafts } from "./data/persist-drafts";
import {
	APP_RELEASE_NOTES,
	currentReleasePlatform,
	releaseNotesFor,
} from "./data/release-notes";
import { WHATS_NEW_SEEN_KEY } from "./data/whats-new";

const newestRelease = releaseNotesFor(
	APP_RELEASE_NOTES,
	currentReleasePlatform(),
)[0]?.version;

beforeEach(() => {
	try {
		localStorage.clear();
		localStorage.setItem("colibri:notification-prompt-answered", "true");
		if (newestRelease) localStorage.setItem(WHATS_NEW_SEEN_KEY, newestRelease);
	} catch {}
	clearAttachmentDrafts();
	clearToasts();
	setAppActive(true);
});

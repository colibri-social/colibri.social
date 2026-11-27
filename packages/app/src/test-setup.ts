import { setLogLevel } from "@colibri-social/lib";
import { clearToasts, setAppActive } from "@colibri-social/ui";
import { beforeEach } from "vitest";
import { clearAttachmentDrafts } from "./data/persist-drafts";
import {
	APP_RELEASE_NOTES,
	currentReleasePlatform,
	releaseNotesFor,
} from "./data/release-notes";
import { WHATS_NEW_SEEN_KEY } from "./data/whats-new";

setLogLevel("error");

const SOLID_OWNERLESS =
	"computations created outside a `createRoot` or `render`";

const reportWarning = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
	if (typeof args[0] === "string" && args[0].startsWith(SOLID_OWNERLESS)) {
		return;
	}

	reportWarning(...args);
};

const RESIZE_LOOP =
	"ResizeObserver loop completed with undelivered notifications.";

const reportError = console.error.bind(console);

console.error = (...args: unknown[]) => {
	const [first] = args;

	if (first instanceof Error && first.message === RESIZE_LOOP) return;

	reportError(...args);
};

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

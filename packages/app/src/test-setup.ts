import { setLogLevel } from "@colibri-social/lib";
import { clearToasts, setAppActive } from "@colibri-social/ui";
import { beforeEach } from "vitest";
import { commands, page } from "vitest/browser";
import { clearAttachmentDrafts } from "./data/persist-drafts";
import {
	APP_RELEASE_NOTES,
	currentReleasePlatform,
	releaseNotesFor,
} from "./data/release-notes";
import { WHATS_NEW_SEEN_KEY } from "./data/whats-new";

setLogLevel("error");

declare module "vitest/browser" {
	interface BrowserCommands {
		resetPageScale: () => Promise<void>;
	}
}

const setViewport = page.viewport.bind(page);

const nextFrame = () => {
	return new Promise((resolve) => requestAnimationFrame(resolve));
};

page.viewport = async (width: number, height: number) => {
	await setViewport(width, height);
	await commands.resetPageScale();

	while (window.innerWidth !== width || window.innerHeight !== height) {
		await nextFrame();
	}

	await nextFrame();
};

type FrameNavigation = {
	canGoBack: boolean;
	currentEntry: { index: number } | null;
};

const frameNavigation = (globalThis as { navigation?: FrameNavigation })
	.navigation;

if (frameNavigation) {
	const goBack = history.back.bind(history);
	const goBy = history.go.bind(history);

	history.back = () => {
		if (frameNavigation.canGoBack) goBack();
	};

	history.go = (delta = 0) => {
		const index = frameNavigation.currentEntry?.index ?? 0;

		if (delta < 0 && index + delta < 0) return;

		goBy(delta);
	};
}

const mediaDevices = navigator.mediaDevices;

if (mediaDevices) {
	const listen = mediaDevices.addEventListener.bind(mediaDevices);

	mediaDevices.addEventListener = (
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	) => {
		if (type === "devicechange" || !listener) return;

		listen(type, listener, options);
	};
}

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

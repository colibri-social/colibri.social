import { useLocation, useNavigate } from "@solidjs/router";
import {
	buildChannelPath,
	buildThreadPath,
	parseThreadPath,
} from "../atproto/colibri-channel-url";
import type { ThreadView } from "../atproto/views";
import { useThreads } from "../contexts/Threads";
import { createMobilePane, openThread, useIsMobile } from "./mobile-pane";
import {
	channelPathOf,
	invertPresentation,
	type ThreadPresentation,
	threadHref,
} from "./thread-presentation";

export const useThreadSurfaceOpen = (): (() => boolean) => {
	const location = useLocation();
	const threads = useThreads();
	return () =>
		parseThreadPath(location.pathname) !== null ||
		threads.draft() !== undefined;
};

export const useThreadNavigation = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const isMobile = useIsMobile();
	const { popPane } = createMobilePane();

	const open = (
		thread: Pick<ThreadView, "space" | "channel">,
		defaultMode: ThreadPresentation,
		event?: { shiftKey: boolean },
	): void => {
		const path = buildThreadPath(thread.channel, thread.space);
		if (!path) return;

		if (isMobile()) {
			openThread(navigate, path);
			return;
		}

		const mode = event?.shiftKey
			? invertPresentation(defaultMode)
			: defaultMode;
		navigate(threadHref(path, mode));
	};

	const expand = (): void => {
		navigate(location.pathname);
	};

	const close = (channel?: string): void => {
		if (isMobile()) {
			popPane();
			return;
		}

		const path =
			(channel === undefined ? undefined : buildChannelPath(channel)) ??
			channelPathOf(location.pathname);
		navigate(path);
	};

	return { open, expand, close };
};

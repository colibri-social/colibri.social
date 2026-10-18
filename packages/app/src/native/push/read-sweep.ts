import { channelSlug } from "../../data/ids";
import { isUnread } from "../../data/notifications";
import type { DataStore } from "../../data/store";

export const READ_SWEEP_DELAY_MS = 3_000;

export type ReadSweepStore = Pick<
	DataStore,
	"communities" | "space" | "notifications"
>;

export const readTargets = (store: ReadSweepStore): string[] => {
	const targets = new Set<string>();
	for (const community of store.communities.value() ?? []) {
		const space = store.space(community);
		for (const channel of space.channels.value() ?? []) {
			if (!space.unread(channelSlug(channel)).hasUnread) {
				targets.add(channel.space);
			}
		}
	}
	const views = store.notifications.items();
	const unseenThreads = new Set(
		views
			.filter((view) => view.thread && isUnread(view))
			.map((view) => view.thread),
	);
	for (const view of views) {
		if (view.thread && !unseenThreads.has(view.thread))
			targets.add(view.thread);
	}
	return [...targets];
};

export const createReadSweep = (options: {
	targets: () => string[];
	dismiss: (channels: string[]) => void;
	delayMs?: number;
}) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		schedule: () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				timer = undefined;
				const channels = options.targets();
				if (channels.length) options.dismiss(channels);
			}, options.delayMs ?? READ_SWEEP_DELAY_MS);
		},
		cancel: () => {
			clearTimeout(timer);
			timer = undefined;
		},
	};
};

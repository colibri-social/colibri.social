import type { StorageNoticeProps } from "@colibri-social/ui";
import type { HostStatus } from "./host-mode";

export type StorageNoticeView = Pick<StorageNoticeProps, "state" | "progress">;

export const storageNoticeOf = (
	status: HostStatus | undefined,
): StorageNoticeView | undefined => {
	if (!status || status.mode === "native") return undefined;
	if (status.mode === "polyfill") return { state: "hosted" };

	const migration = status.migration;

	return {
		state: "moving",
		...(migration
			? {
					progress: {
						done: migration.spacesDone,
						total: migration.spacesTotal,
					},
				}
			: {}),
	};
};

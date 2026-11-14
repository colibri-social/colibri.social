import { StorageNotice } from "@colibri-social/ui";
import { Show } from "solid-js";
import { hostingStatus } from "../../data/polyfill/host-mode";
import { storageNoticeOf } from "../../data/polyfill/notice";

export const AccountStorageNotice = () => (
	<Show when={storageNoticeOf(hostingStatus())}>
		{(notice) => (
			<StorageNotice state={notice().state} progress={notice().progress} />
		)}
	</Show>
);

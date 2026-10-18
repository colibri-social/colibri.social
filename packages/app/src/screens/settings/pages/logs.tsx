import { LogsSettings } from "@colibri-social/ui";
import { createLogFeed } from "../../../data/log-buffer";
import type { Platform } from "../../../screen/platform";

export default function LogsPage(_props: { platform: Platform }) {
	const feed = createLogFeed();
	return (
		<LogsSettings
			lines={feed.lines()}
			verbose={feed.verbose()}
			onVerboseChange={feed.setVerbose}
			copyValue={feed.text() || undefined}
		/>
	);
}

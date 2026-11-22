import { recordExplorerHref } from "@colibri-social/ui";
import { openExternalUrl } from "./open-external";

export const openInRecordExplorer = (value: string | undefined) => {
	const href = recordExplorerHref(value);
	if (href) openExternalUrl(href);
};

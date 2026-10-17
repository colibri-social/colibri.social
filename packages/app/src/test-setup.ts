import { clearToasts } from "@colibri-social/ui";
import { beforeEach } from "vitest";
import { clearAttachmentDrafts } from "./data/persist-drafts";

beforeEach(() => {
	try {
		localStorage.clear();
		localStorage.setItem("colibri:notification-prompt-answered", "true");
	} catch {}
	clearAttachmentDrafts();
	clearToasts();
});

import { clearToasts } from "@colibri-social/ui";
import { beforeEach } from "vitest";
import { clearAttachmentDrafts } from "./data/persist-drafts";

beforeEach(() => {
	try {
		localStorage.clear();
	} catch {}
	clearAttachmentDrafts();
	clearToasts();
});

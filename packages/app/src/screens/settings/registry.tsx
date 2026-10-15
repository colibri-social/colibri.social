import {
	DOCUMENTATION_URL,
	FEEDBACK_URL,
	SETTINGS_ENTRY_INFO,
	type SettingsEntries,
	type SettingsEntryId,
	toast,
} from "@colibri-social/ui";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { DataStore } from "../../data/store";
import { sellsThroughAppStore } from "../../native/app-store";
import type { Platform } from "../../screen/platform";
import { accountPageOf } from "./account-page";
import type { SettingsNav, SettingsPageId } from "./nav";
import AdvancedPage from "./pages/advanced";
import AppearancePage from "./pages/appearance";
import ChatPage from "./pages/chat";
import DebugInformationPage from "./pages/debug-information";
import DeleteAccountPage from "./pages/delete-account";
import ExperimentsPage from "./pages/experiments";
import LogsPage from "./pages/logs";
import NotificationsPage from "./pages/notifications";
import SupportPage from "./pages/support";
import VoiceVideoPage from "./pages/voice-video";
import WhatsNewPage from "./pages/whats-new";

type PageProps = { platform: Platform };

type PageInfo = {
	title: string;
	entry?: SettingsEntryId;
	view?: Component<PageProps>;
};

export const SETTINGS_PAGES: Record<SettingsPageId, PageInfo> = {
	profile: { title: "Profile", entry: "profile" },
	deleteAccount: {
		title: "Delete my Colibri data",
		entry: "advanced",
		view: DeleteAccountPage,
	},
	voiceVideo: {
		title: SETTINGS_ENTRY_INFO.voiceVideo.label,
		entry: "voiceVideo",
		view: VoiceVideoPage,
	},
	appearance: {
		title: SETTINGS_ENTRY_INFO.appearance.label,
		entry: "appearance",
		view: AppearancePage,
	},
	chat: {
		title: SETTINGS_ENTRY_INFO.chat.label,
		entry: "chat",
		view: ChatPage,
	},
	notifications: {
		title: SETTINGS_ENTRY_INFO.notifications.label,
		entry: "notifications",
		view: NotificationsPage,
	},
	advanced: {
		title: SETTINGS_ENTRY_INFO.advanced.label,
		entry: "advanced",
		view: AdvancedPage,
	},
	whatsNew: {
		title: SETTINGS_ENTRY_INFO.whatsNew.label,
		entry: "whatsNew",
		view: WhatsNewPage,
	},
	support: {
		title: SETTINGS_ENTRY_INFO.support.label,
		entry: "support",
		view: SupportPage,
	},
	experiments: {
		title: SETTINGS_ENTRY_INFO.experiments.label,
		entry: "experiments",
		view: ExperimentsPage,
	},
	debugInfo: {
		title: SETTINGS_ENTRY_INFO.debugInfo.label,
		entry: "debugInfo",
		view: DebugInformationPage,
	},
	logs: {
		title: SETTINGS_ENTRY_INFO.logs.label,
		entry: "logs",
		view: LogsPage,
	},
};

export const SettingsPageView = (props: {
	page: SettingsPageId;
	platform: Platform;
}) => (
	<Dynamic
		component={SETTINGS_PAGES[props.page].view}
		platform={props.platform}
	/>
);

const pdslsHref = (did: string) => `https://pdsls.dev/at://${did}`;

const copyDid = async (did: string) => {
	try {
		await navigator.clipboard.writeText(did);
		toast.success("DID copied");
	} catch {
		toast.error("Couldn't copy your DID", {
			description: "Give it another try.",
		});
	}
};

export const settingsEntries = (
	data: DataStore,
	nav: SettingsNav,
): SettingsEntries => {
	const page = (id: SettingsPageId) => ({ onSelect: () => nav.open(id) });
	const external = (href: string) => ({ href, external: true });
	const developer = data.preferences.client().developerMode;
	const accountPage = accountPageOf(data);
	return {
		profile: page("profile"),
		...(accountPage ? { atmosphereAccount: external(accountPage) } : {}),
		voiceVideo: page("voiceVideo"),
		appearance: page("appearance"),
		chat: page("chat"),
		notifications: page("notifications"),
		advanced: page("advanced"),
		whatsNew: page("whatsNew"),
		feedback: external(FEEDBACK_URL),
		documentation: external(DOCUMENTATION_URL),
		...(sellsThroughAppStore() ? {} : { support: page("support") }),
		experiments: page("experiments"),
		...(developer
			? {
					copyDid: { onSelect: () => void copyDid(data.viewer.did) },
					pdsls: external(pdslsHref(data.viewer.did)),
					debugInfo: page("debugInfo"),
					logs: page("logs"),
				}
			: {}),
	};
};

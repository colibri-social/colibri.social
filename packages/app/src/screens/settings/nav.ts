import { createContext, useContext } from "solid-js";

export const SETTINGS_PAGE_IDS = [
	"profile",
	"editProfile",
	"deleteAccount",
	"voiceVideo",
	"appearance",
	"chat",
	"notifications",
	"advanced",
	"whatsNew",
	"support",
	"experiments",
	"debugInfo",
	"logs",
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGE_IDS)[number];

export const isSettingsPage = (page: unknown): page is SettingsPageId =>
	(SETTINGS_PAGE_IDS as readonly unknown[]).includes(page);

export type SettingsNav = {
	open: (page: SettingsPageId) => void;
	back: () => void;
};

export const SettingsNavContext = createContext<SettingsNav>();

export const useSettingsNav = () => {
	const nav = useContext(SettingsNavContext);
	if (!nav) throw new Error("useSettingsNav needs a SettingsNavContext");
	return nav;
};

export const ATMOSPHERE_ACCOUNT_URL = "https://atmosphereaccount.com/";

export const settingsPage = (page: unknown): SettingsPageId =>
	isSettingsPage(page) ? page : "profile";

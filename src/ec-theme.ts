import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import type { ThemeRegistration } from "shiki";

const colibriDark: ThemeRegistration = {
	...githubDark,
	name: "Colibri Dark",
	colors: {
		...githubDark.colors,
		"activityBar.background": "#151515",
		"editor.background": "#101010",
		"statusBar.background": "#151515",
		"statusBarItem.remoteBackground": "#151515",
		"tab.activeBackground": "#151515",
		"titleBar.activeBackground": "#151515",
		"editorGroupHeader.tabsBackground": "#151515",
		"panel.background": "#101010",
	},
};

const colibriLight: ThemeRegistration = {
	...githubLight,
	name: "Colibri Light",
	colors: {
		...githubLight.colors,
		"statusBar.background": "#ffffff",
		"statusBarItem.remoteBackground": "#ffffff",
		"tab.activeBackground": "#ffffff",
		"titleBar.activeBackground": "#ffffff",
		"editorGroupHeader.tabsBackground": "#ffffff",
		"activityBar.background": "#ffffff",
		// "activityBar.background": "#151515",
		// "editor.background": "#101010",
		// "statusBar.background": "#151515",
		// "statusBarItem.remoteBackground": "#151515",
		// "tab.activeBackground": "#151515",
		// "titleBar.activeBackground": "#151515",
		// "editorGroupHeader.tabsBackground": "#151515",
		// "panel.background": "#101010",
	},
};

export { colibriDark, colibriLight };

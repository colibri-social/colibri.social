import type { JSX } from "solid-js";

export type ChatPlatform = "desktop" | "mobile";

export type ChatLayout = {
	composerPadding: number;
	composerInset: number;
	composerGap: number;
	toolSize: number;
	avatarSize: number;
	rowPadding: number;
	avatarGap: number;
	rowEndPadding: number;
	groupGap: number;
};

const build = (
	platform: ChatPlatform,
	values: Omit<ChatLayout, "rowPadding" | "avatarGap" | "toolSize">,
): ChatLayout => {
	const toolSize = 32;
	const textStart =
		values.composerPadding +
		values.composerInset +
		toolSize +
		values.composerGap;
	const rowPadding =
		platform === "desktop"
			? values.composerPadding +
				values.composerInset +
				toolSize / 2 -
				values.avatarSize / 2
			: values.composerPadding;
	return {
		...values,
		toolSize,
		rowPadding,
		avatarGap: textStart - rowPadding - values.avatarSize,
	};
};

export const CHAT_LAYOUT: Record<ChatPlatform, ChatLayout> = {
	desktop: build("desktop", {
		composerPadding: 16,
		composerInset: 13,
		composerGap: 12,
		avatarSize: 40,
		rowEndPadding: 16,
		groupGap: 12,
	}),
	mobile: build("mobile", {
		composerPadding: 8,
		composerInset: 9,
		composerGap: 8,
		avatarSize: 40,
		rowEndPadding: 8,
		groupGap: 16,
	}),
};

export const chatTextStart = (platform: ChatPlatform) => {
	const layout = CHAT_LAYOUT[platform];
	return layout.rowPadding + layout.avatarSize + layout.avatarGap;
};

export const chatLayoutVars = (platform: ChatPlatform): JSX.CSSProperties => {
	const layout = CHAT_LAYOUT[platform];
	return {
		"--chat-row-padding": `${layout.rowPadding}px`,
		"--chat-row-end-padding": `${layout.rowEndPadding}px`,
		"--chat-avatar-gap": `${layout.avatarGap}px`,
		"--chat-group-gap": `${layout.groupGap}px`,
		"--chat-text-start": `${chatTextStart(platform)}px`,
		"--composer-padding": `${layout.composerPadding}px`,
		"--composer-inset": `${layout.composerInset}px`,
		"--composer-gap": `${layout.composerGap}px`,
	};
};

export const isTextChannelType = (type: string): boolean =>
	type === "text" || type === "social.colibri.channel.text";

export const isVoiceChannelType = (type: string): boolean =>
	type === "voice" || type === "social.colibri.channel.voice";

export const isForumChannelType = (type: string): boolean =>
	type === "forum" || type === "social.colibri.channel.forum";

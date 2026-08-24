export type ChannelExit = "stay" | "leave";

export const decideChannelExit = (
	authoritative: boolean,
	channelParam: string,
	channelPresent: boolean,
): ChannelExit => {
	if (channelParam === "") return "stay";
	if (channelPresent) return "stay";
	if (!authoritative) return "stay";
	return "leave";
};

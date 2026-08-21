export type ChannelAccess = {
	ownerOnly?: boolean;
	allowedRoles?: Array<string>;
	allowedMembers?: Array<string>;
};

export const isChannelRestricted = (
	channel: ChannelAccess | undefined,
): boolean =>
	!!channel?.ownerOnly ||
	(channel?.allowedRoles?.length ?? 0) > 0 ||
	(channel?.allowedMembers?.length ?? 0) > 0;

export const canSendMessagesInChannel = (input: {
	channel: ChannelAccess | undefined;
	memberRoles: Array<string> | undefined;
	isCommunityOwner: boolean;
	userDid: string;
}): boolean => {
	if (!input.memberRoles) return false;
	if (input.isCommunityOwner) return true;
	if (!isChannelRestricted(input.channel)) return true;
	if (input.channel?.allowedMembers?.includes(input.userDid)) return true;

	return input.memberRoles.some(
		(role) => input.channel?.allowedRoles?.includes(role) === true,
	);
};

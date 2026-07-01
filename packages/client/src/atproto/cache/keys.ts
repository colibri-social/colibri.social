export const namespace = (appViewDid: string, did: string): string =>
	`${appViewDid}:${did}`;

export const communityKey = (ns: string, uri: string): string => `${ns}:${uri}`;

export const messagesKey = (ns: string, channelUri: string): string =>
	`${ns}:${channelUri}`;

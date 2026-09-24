export const platformName = (platform: string): string =>
	platform.length === 0
		? "another service"
		: `${platform[0]?.toUpperCase()}${platform.slice(1)}`;

export const authorKey = (author: {
	did: string;
	bridge?: { registration: string; remoteId: string };
}): string =>
	author.bridge
		? `${author.did} ${author.bridge.registration} ${author.bridge.remoteId}`
		: author.did;

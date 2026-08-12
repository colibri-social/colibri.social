/**
 * Resolves a record reference that may be either a full AT URI or a bare
 * record key into a full AT URI within the given repo and collection.
 */
export const toRecordUri = (
	did: string,
	collection: string,
	rkeyOrUri: string,
): string =>
	rkeyOrUri.startsWith("at://")
		? rkeyOrUri
		: `at://${did}/${collection}/${rkeyOrUri}`;

const TEXT_CHANNEL_COLLECTION = "social.colibri.channel.text";

export const channelIdentity = (
	channelUri: string,
): { communityDid: string; rkey: string } => {
	const segments = channelUri.replace("at://", "").split("/");
	return { communityDid: segments[0], rkey: segments[segments.length - 1] };
};

export const channelPath = (channelUri: string): string => {
	const { communityDid, rkey } = channelIdentity(channelUri);
	return `/app/c/${communityDid}/${TEXT_CHANNEL_COLLECTION}/${rkey}`;
};

export class AtURI {
	public uri: string;
	public did: string;
	public collection: string;
	public identifier: string;

	constructor(uri: string) {
		this.uri = uri;

		const { did, collection, identifier } = AtURI.parseAtURI(uri);

		this.did = did;
		this.collection = collection;
		this.identifier = identifier;
	}

	/**
	 * Parses an AT URI into it's did, collection and identifier
	 * @param uri The URI to parse
	 * @returns An object containing the DID, collection and identifier
	 */
	public static parseAtURI = (uri: string) => {
		const parts = uri.split("/");

		return {
			did: parts[2],
			collection: parts[3],
			identifier: parts[4],
		};
	};
}

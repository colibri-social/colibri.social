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

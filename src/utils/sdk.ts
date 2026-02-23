import type { Agent } from "@atproto/api";
import { lexicon, RECORD_IDs } from "./atproto/lexicons";

type ActorData = {
	status: string;
	communities: Array<string>;
};

export type CommunityData = {
	name: string;
	picture?: string;
	description: string;
	categoryOrder: Array<string>;
	rkey: string;
};

export type CategoryData = {
	name: string;
	channelOrder: Array<string>;
	community: string;
	rkey: string;
};

export type ChannelType = "text" | "voice" | "forum";

export type ChannelData = {
	name: string;
	description?: string;
	type: ChannelType;
	category: string;
	rkey: string;
};

export type MessageData = {
	text: string;
	createdAt: string;
	channel: string;
	rkey: string;
	author_did: string;
	display_name: string;
	avatar_url: string;
	edited?: boolean;
	parent?: string;
};

export type MessageReactionData = {
	emoji: string;
	authors: Array<string>;
	count: number;
	rkeys: Array<string>;
};

export type IndexedMessageData = {
	text: string;
	created_at: string;
	channel: string;
	rkey: string;
	author_did: string;
	display_name: string;
	avatar_url: string;
	parent: string | null;
	parent_message: IndexedMessageData | null;
	reactions: Array<MessageReactionData>;
};

interface AtProtoRecord<T extends string, K> {
	repo: string;
	collection: T;
	record: K & {
		$type: T;
	};
}

export class ColibriSDK {
	agent: Agent;

	constructor(_agent: Agent) {
		this.agent = _agent;
	}

	/**
	 * Constructs an atproto record and validates it using the lexicon
	 * @param did The DID of the user this record will be created for.
	 * @param repoAndType The repository's name (which will also be used for the `$type` of the record)
	 * @param data The data for the record
	 * @returns The constructed record if valid
	 */
	private constructAtProtoRecord = <
		T extends Record<string, any>,
		K extends string,
	>(
		did: string,
		repoAndType: string,
		data: T,
		rkey?: K,
	): K extends undefined
		? AtProtoRecord<string, T>
		: AtProtoRecord<string, T> & { rkey: K } => {
		const record = {
			repo: did,
			collection: repoAndType,
			rkey,
			record: {
				$type: repoAndType,
				...data,
			},
		} as ReturnType<typeof this.constructAtProtoRecord>;

		lexicon.assertValidRecord(repoAndType, record.record);

		return record;
	};

	/**
	 * Creates basic actor data for a given DID.
	 * @param did The DID of the user.
	 * @param existenceChecked Whether a previous function has verified that the record does not yet exist.
	 */
	public createActorData = async (
		did: string,
	): Promise<AtProtoRecord<string, ActorData>> => {
		const record = this.constructAtProtoRecord(
			did,
			RECORD_IDs.ACTOR_DATA,
			{
				status: "",
				communities: [],
			},
			"self",
		);

		await this.agent.com.atproto.repo.createRecord(record);

		return record;
	};

	/**
	 * Gets the actor data for a given DID. This function
	 * will create the record if it doesn't exist yet.
	 * @param did The DID of the user.
	 * @param createIfNotFound Whether to create the record if it isn't found.
	 */
	public getActorData = async <T extends boolean>(
		did: string,
		createIfNotFound: T,
	): Promise<T extends false ? ActorData | undefined : ActorData> => {
		try {
			const actorData = await this.agent.com.atproto.repo.getRecord({
				repo: did,
				collection: RECORD_IDs.ACTOR_DATA,
				rkey: "self",
			});

			return actorData.data.value as ActorData;
		} catch (e) {
			console.error(
				`Unable to get actor data for ${did}: ${e}${createIfNotFound ? "\nAttempting to create actor data." : ""}`,
			);

			if (createIfNotFound === false) {
				return undefined as any;
			}

			const record = await this.createActorData(did);

			return record.record;
		}
	};

	/**
	 * Creates data for a new community for this user.
	 * @param did The DID of the user.
	 * @param name The name of the new community.
	 * @param description The description of the new community.
	 * @param _image (Unused) The image for the new community.
	 * @returns The CID of the newly created community.
	 */
	public createCommunityData = async (
		did: string,
		name: string,
		description: string,
		_image?: string,
	): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.COMMUNITY, {
			name: name ?? "New community",
			description: description ?? "",
			categoryOrder: [],
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	};

	/**
	 * Returns the record for a given community owned by a user.
	 * @param did The DID of the owner of the community.
	 * @param rkey The record key of the community.
	 * @returns The community data.
	 */
	public getCommunityData = async (
		did: string,
		rkey: string,
	): Promise<CommunityData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.COMMUNITY,
			repo: did,
			rkey,
		});

		return { ...res.data.value, rkey } as CommunityData;
	};

	/**
	 * Returns a list of all communites a certain user owns.
	 * @param did The DID of the user.
	 * @returns The community data of all communities the user owns.
	 */
	public getCommunities = async (
		did: string,
	): Promise<Array<CommunityData>> => {
		const communities = await this.agent.com.atproto.repo.listRecords({
			repo: did,
			collection: RECORD_IDs.COMMUNITY,
		});

		const data = communities.data.records.map((record) => {
			const rkey = record.uri.split("/").pop()!;
			return {
				...record.value,
				rkey,
			} as CommunityData;
		});

		return data;
	};

	/**
	 * A helper function to create data for a new category.
	 * @param did The DID of the user that owns the community this category is in.
	 * @param community The community the category will be assigned to.
	 * @param name The name of the new category.
	 * @returns The record key of the newly created category.
	 */
	public createCategoryData = async (
		did: string,
		community: string,
		name: string,
	): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.CATEGORY, {
			name: name ?? "New category",
			community,
			channelOrder: [],
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	};

	/**
	 * Modifies the data of a given community.
	 * @param did The DID of the user the community belongs to.
	 * @param community The community to modify.
	 * @param data The new data to insert. Overwrites any existing data and should be complete.
	 */
	public modifyCommunityData = async (
		did: string,
		community: string,
		data: CommunityData,
	): Promise<void> => {
		const record = this.constructAtProtoRecord(
			did,
			RECORD_IDs.COMMUNITY,
			data,
			community,
		);

		await this.agent.com.atproto.repo.putRecord(record);
	};

	/**
	 * A helper function to add a category to a community.
	 * @param did The DID of the user that owns the community.
	 * @param community The record key of the community to add the category to.
	 * @param category The record key of the category to add.
	 */
	public addCategoryToCommunity = async (
		did: string,
		community: string,
		category: string,
	): Promise<void> => {
		const existingRecord = await this.getCommunityData(did, community);

		existingRecord.categoryOrder.push(category);

		await this.modifyCommunityData(did, community, existingRecord);
	};

	/**
	 * Returns the data for a given category.
	 * @param did The DID of the user who owns the category.
	 * @param rkey The record key of the category.
	 * @returns The category data.
	 */
	public getCategoryData = async (
		did: string,
		rkey: string,
	): Promise<CategoryData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.CATEGORY,
			repo: did,
			rkey,
		});

		return { ...res.data.value, rkey } as CategoryData;
	};

	/**
	 * Returns the category data for a given array of category record keys.
	 * @param did The DID of the user the categories belong to.
	 * @param categoryRecordKeys The category record keys to fetch.
	 * @returns An array of category data.
	 */
	public getCategories = async (
		did: string,
		categoryRecordKeys: Array<string>,
	): Promise<Array<CategoryData>> => {
		const categories = categoryRecordKeys.map((key) =>
			this.getCategoryData(did, key),
		);

		return Promise.all(categories);
	};

	/**
	 * A helper function to create data for a new channel.
	 * @param did The DID of the user who owns the channel.
	 * @param category The category the channel will be placed in.
	 * @param name The name of the channel.
	 * @param type The type of the channel. One of `text`, `voice` or `forum`.
	 * @returns The record key of the newly created channel.
	 */
	public createChannelData = async (
		did: string,
		category: string,
		name: string,
		type: ChannelType,
	): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.CHANNEL, {
			name: name ?? "New channel",
			type,
			category,
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	};

	/**
	 * A helper function to modify the data of a category.
	 * @param did The DID of the user who owns the category.
	 * @param category The record key of the category to edit.
	 * @param data The new data to insert. Overwrites any existing data and should be complete.
	 */
	public modifyCategoryData = async (
		did: string,
		category: string,
		data: CategoryData,
	): Promise<void> => {
		const record = this.constructAtProtoRecord(
			did,
			RECORD_IDs.CATEGORY,
			data,
			category,
		);

		await this.agent.com.atproto.repo.putRecord(record);
	};

	/**
	 * Gets all data for a given channel.
	 * @param did The DID of the user who owns the channel.
	 * @param rkey The record key of the channel.
	 * @returns The channel data.
	 */
	public getChannelData = async (
		did: string,
		rkey: string,
	): Promise<ChannelData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.CHANNEL,
			repo: did,
			rkey,
		});

		return { ...res.data.value, rkey } as ChannelData;
	};

	/**
	 * Returns the channel data for a given array of channel record keys.
	 * @param did The DID of the user the categories belong to.
	 * @param channelRecordKeys The channel record keys to fetch.
	 * @returns An array of channel data.
	 */
	public getChannels = async (
		did: string,
		channelRecordKeys: Array<string>,
	): Promise<Array<ChannelData>> => {
		const categories = channelRecordKeys.map((key) =>
			this.getChannelData(did, key),
		);

		return Promise.all(categories);
	};

	/**
	 * A helper function to add a channel to a category.
	 * @param did The DID of the user that owns the category.
	 * @param category The record key of the category to add the channel to.
	 * @param channel The record key of the channel to add.
	 */
	public addChannelToCategory = async (
		did: string,
		category: string,
		channel: string,
	): Promise<void> => {
		const existingRecord = await this.getCategoryData(did, category);

		existingRecord.channelOrder.push(channel);

		await this.modifyCategoryData(did, category, existingRecord);
	};

	/**
	 * A helper function to create data for a new message.
	 * @param did The DID of the user who owns the message.
	 * @param channel The channel the message was sent in.
	 * @param text The text of the message.
	 * @param createdAt The timestamp the message was sent at.
	 * @returns The record key of the newly posted message.
	 */
	public createMessageData = async (
		did: string,
		channel: string,
		text: string,
		createdAt: string,
		parent?: string,
	): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.MESSAGE, {
			text,
			createdAt,
			channel,
			parent,
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	};

	/**
	 * Edits a given message by it's channel and record key.
	 * @param did The DID of the message owner.
	 * @param channel The channel the message was sent in.
	 * @param text The new text to be used for the message.
	 * @param rkey The record key of the message to be edited.
	 */
	public editMessage = async (
		did: string,
		channel: string,
		text: string,
		rkey: string,
	): Promise<void> => {
		const { createdAt } = await this.getMessageData(did, rkey);

		const newRecord = this.constructAtProtoRecord(did, RECORD_IDs.MESSAGE, {
			text,
			createdAt,
			channel,
		});

		await this.agent.com.atproto.repo.putRecord(newRecord);
	};

	public deleteMessage = async (did: string, rkey: string): Promise<void> => {
		await this.agent.com.atproto.repo.deleteRecord({
			repo: did,
			collection: RECORD_IDs.MESSAGE,
			rkey,
		});
	};

	/**
	 * Returns all data for a given message.
	 * @param did The DID of the user who owns the message.
	 * @param rkey The record key of the message.
	 * @returns The message data.
	 */
	public getMessageData = async (
		did: string,
		rkey: string,
	): Promise<MessageData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.MESSAGE,
			repo: did,
			rkey,
		});

		return { ...res.data.value, rkey, author_did: did } as MessageData;
	};

	/**
	 * Creates reaction data for a specific message.
	 * @param did The DID of the current user
	 * @param emoji The emoji to be reacted with
	 * @param message The record key of the message this reaction will belong to
	 * @returns The record key of the newly created reaction
	 */
	public createReactionData = async (
		did: string,
		emoji: string,
		parent: string,
	): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.REACTION, {
			emoji,
			parent,
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	};

	/**
	 * Deletes a given reaction.
	 * @param did The DID of the current user
	 * @param rkey The record key of the reaction
	 */
	public deleteReaction = async (did: string, rkey: string): Promise<void> => {
		await this.agent.com.atproto.repo.deleteRecord({
			repo: did,
			collection: RECORD_IDs.REACTION,
			rkey,
		});
	};
}

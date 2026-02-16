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
};

type CategoryData = {
	name: string;
	channelOrder: Array<string>;
	community: string;
};

type ChannelType = 'text' | 'voice' | 'forum';

type ChannelData = {
	name: string;
	description?: string;
	type: ChannelType;
	category: string;
};

type MessageData = {
	text: string;
	createdAt: string;
	channel: string;
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
		K extends string
	>(
		did: string,
		repoAndType: string,
		data: T,
		rkey?: K,
	): K extends undefined ? AtProtoRecord<string, T> : AtProtoRecord<string, T> & { rkey: K } => {
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
		did: string
	): Promise<AtProtoRecord<string, ActorData>> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.ACTOR_DATA, {
			status: "",
			communities: [],
		}, 'self');

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
	): Promise<
		T extends false
		? ActorData | undefined
		: ActorData
	> => {
		try {
			const actorData = await this.agent.com.atproto.repo.getRecord({
				repo: did,
				collection: RECORD_IDs.ACTOR_DATA,
				rkey: 'self',
			});

			return actorData.data.value as ActorData;
		} catch (e) {
			console.error(`Unable to get actor data for ${did}: ${e}${createIfNotFound ? "\nAttempting to create actor data." : ''}`);

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
 * @returns The CID of the newly created community.
 */
	public createCommunityData = async (did: string): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.COMMUNITY, {
			name: "New community",
			description: "",
			categoryOrder: []
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	}

	public getCommunityData = async (did: string, rkey: string): Promise<CommunityData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.COMMUNITY,
			repo: did,
			rkey
		});

		return res.data.value as CommunityData;
	}

	// TODO: Use listRecords
	public getCommunities = async (did: string): Promise<Array<{ rkey: string, data: CommunityData }>> => {
		const communities = await this.agent.com.atproto.repo.listRecords({
			repo: did,
			collection: RECORD_IDs.COMMUNITY
		});

		const promises = communities.data.records.map(async (record) => {
			const rkey = record.uri.split("/").pop()!;
			const data = await this.getCommunityData(did, rkey);
			return {
				rkey,
				data
			}
		});

		return Promise.all(promises);
	}

	public createCategoryData = async (did: string, community: string): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.CATEGORY, {
			name: "New category",
			community,
			channelOrder: []
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	}

	public modifyCommunityData = async (did: string, community: string, data: CommunityData): Promise<void> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.COMMUNITY, data, community);

		await this.agent.com.atproto.repo.putRecord(record);
	}

	public addCategoryToCommunity = async (did: string, community: string, category: string): Promise<void> => {
		const existingRecord = await this.getCommunityData(did, community);

		existingRecord.categoryOrder.push(category);

		await this.modifyCommunityData(did, community, existingRecord);
	}

	public getCategoryData = async (did: string, rkey: string): Promise<CategoryData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.CATEGORY,
			repo: did,
			rkey
		});

		return res.data.value as CategoryData;
	}

	// TODO: Use listRecords
	public getCategories = async (did: string, categoryRecordKeys: Array<string>): Promise<Array<CategoryData>> => {
		const categories = categoryRecordKeys.map((key) => this.getCategoryData(did, key));

		return Promise.all(categories);
	}

	public createChannelData = async (did: string, category: string, type: ChannelType): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.CHANNEL, {
			name: "New channel",
			type: "text",
			category
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	}

	public modifyCategoryData = async (did: string, category: string, data: CategoryData): Promise<void> => {
		console.log(did, category, data);
		const record = this.constructAtProtoRecord(did, RECORD_IDs.CATEGORY, data, category);

		await this.agent.com.atproto.repo.putRecord(record);
	}

	public getChannelData = async (did: string, rkey: string): Promise<ChannelData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.CHANNEL,
			repo: did,
			rkey
		});

		return res.data.value as ChannelData;
	}

	// TODO: Use listRecords
	public getChannels = async (did: string, channelRecordKeys: Array<string>): Promise<Array<ChannelData>> => {
		const categories = channelRecordKeys.map((key) => this.getChannelData(did, key));

		return Promise.all(categories);
	}

	public addChannelToCategory = async (did: string, category: string, channel: string): Promise<void> => {
		const existingRecord = await this.getCategoryData(did, category);

		console.log(did, category, channel);

		existingRecord.channelOrder.push(channel);

		await this.modifyCategoryData(did, category, existingRecord);
	}

	public createMessageData = async (did: string, channel: string, text: string, createdAt: string): Promise<string> => {
		const record = this.constructAtProtoRecord(did, RECORD_IDs.MESSAGE, {
			text,
			createdAt,
			channel
		});

		const res = await this.agent.com.atproto.repo.createRecord(record);

		return res.data.uri.split("/").pop()!;
	}


	public getMessageData = async (did: string, rkey: string): Promise<MessageData> => {
		const res = await this.agent.com.atproto.repo.getRecord({
			collection: RECORD_IDs.MESSAGE,
			repo: did,
			rkey
		});

		return res.data.value as MessageData;
	}

	// TODO: This is *wildly* inefficient. We basically need a relay for this.
	public getMessagesForChannel = async (did: string, channel: string): Promise<Array<MessageData>> => {
		const res = await this.agent.com.atproto.repo.listRecords({
			collection: RECORD_IDs.MESSAGE,
			repo: did
		});

		const filtered = res.data.records.filter((record) => (record.value as MessageData).channel === channel).map((x) => x.value as MessageData);

		return filtered;
	}
}

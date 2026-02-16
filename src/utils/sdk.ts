import type { Agent } from "@atproto/api";

type ActorData = {
	status: string;
	communities: Array<string>;
}

export class ColibriSDK {
	agent: Agent;

	constructor(_agent: Agent) {
		this.agent = _agent;
	}

	/**
	 * Creates basic actor data for a given DID.
	 * @param did The DID of the user.
	 * @param existanceChecked Whether a previous function has verified that the record does not yet exist.
	 */
	public createActorData = async (did: string, existanceChecked?: boolean): Promise<ActorData> => {
		return {} as ActorData;
	}

	/**
	 * Gets the actor data for a given DID. This function
	 * will create the record if it doesn't exist yet.
	 * @param did The DID of the user.
	 * @param createIfNotFound Whether to create the record if it isn't found. (Default: true)
	 */
	public getActorData = async (did: string, createIfNotFound = true): Promise<ActorData> => {
		return {} as ActorData;
	}
}

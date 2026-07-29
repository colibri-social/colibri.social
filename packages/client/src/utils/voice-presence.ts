export type PresenceMember = {
	did: string;
	vc?: string | null;
	vcMuted?: boolean;
	vcDeafened?: boolean;
	vcServerMuted?: boolean;
	vcServerDeafened?: boolean;
};

export type PresenceMemberState = {
	muted: boolean;
	deafened: boolean;
	serverMuted?: boolean;
	serverDeafened?: boolean;
};

export type PresenceChannelPlan = {
	channel: string;
	added: Array<string>;
	left: Array<string>;
	moved: Array<string>;
};

export type PresenceSyncPlan = {
	channels: Array<PresenceChannelPlan>;
	states: Array<{ did: string; state: PresenceMemberState }>;
};

export const authorityOf = (uri: string): string | null => {
	if (!uri.startsWith("at://")) return null;
	return uri.slice("at://".length).split("/")[0] || null;
};

export const computePresenceSync = (args: {
	communityUri: string;
	members: Array<PresenceMember>;
	presence: Record<string, Array<string>>;
	ownChannel: string | null;
	ownDid: string;
}): PresenceSyncPlan => {
	const empty: PresenceSyncPlan = { channels: [], states: [] };

	const authority = authorityOf(args.communityUri);
	if (!authority) return empty;

	const isLocal = (channel: string) => authorityOf(channel) === authority;

	const expected = new Map<string, Set<string>>();
	const states: PresenceSyncPlan["states"] = [];

	const addExpected = (channel: string, did: string) => {
		const dids = expected.get(channel);
		if (dids) dids.add(did);
		else expected.set(channel, new Set([did]));
	};

	for (const member of args.members) {
		if (!member.vc || !isLocal(member.vc)) continue;

		addExpected(member.vc, member.did);
		states.push({
			did: member.did,
			state: {
				muted: member.vcMuted ?? false,
				deafened: member.vcDeafened ?? false,
				serverMuted: member.vcServerMuted,
				serverDeafened: member.vcServerDeafened,
			},
		});
	}

	const ownChannelIsLocal = !!args.ownChannel && isLocal(args.ownChannel);
	if (args.ownChannel && ownChannelIsLocal) {
		addExpected(args.ownChannel, args.ownDid);
	}

	const stillInVoice = new Set<string>();
	for (const dids of expected.values()) {
		for (const did of dids) stillInVoice.add(did);
	}

	const channelUris = new Set(expected.keys());
	for (const channel of Object.keys(args.presence)) {
		if (isLocal(channel)) channelUris.add(channel);
	}

	const channels: Array<PresenceChannelPlan> = [];
	for (const channel of channelUris) {
		const next = expected.get(channel);
		const prev = args.presence[channel] ?? [];

		const plan: PresenceChannelPlan = {
			channel,
			added: [],
			left: [],
			moved: [],
		};

		for (const did of prev) {
			if (next?.has(did)) continue;
			if (stillInVoice.has(did)) plan.moved.push(did);
			else plan.left.push(did);
		}

		for (const did of next ?? []) {
			if (!prev.includes(did)) plan.added.push(did);
		}

		if (plan.added.length || plan.left.length || plan.moved.length) {
			channels.push(plan);
		}
	}

	return {
		channels,
		states: ownChannelIsLocal
			? states.filter((entry) => entry.did !== args.ownDid)
			: states,
	};
};

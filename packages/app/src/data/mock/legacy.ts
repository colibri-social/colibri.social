import type { LiveEvent } from "../source";
import type { Did, LegacyCommunityView } from "../types";
import { createCommunityRecord } from "./communities";
import { withLatency } from "./latency";
import { asDatetime } from "./refs";
import type { World } from "./world";

export const MOCK_MIGRATION_STEPS = [
	"readingLegacyRepo",
	"creatingSpaces",
	"writingProfile",
	"writingSettings",
	"migratingRoles",
	"migratingMembers",
	"migratingBans",
	"migratingChannels",
	"migratingCategories",
	"mirroringMessages",
	"retiringLegacyCommunity",
] as const;

const STEP_MS = 400;

export const SAMPLE_LEGACY_COMMUNITIES: LegacyCommunityView[] = [
	{
		did: "did:plc:legacyroostxxxxxxxxxxxxxx" as Did,
		handle: "roost.colibri.social",
		name: "Owl Roost",
		description: "Late night chats from the old Colibri.",
		memberCount: 42,
		channelCount: 7,
		viewerIsAdmin: true,
		owner: { did: "did:plc:viewerxxxxxxxxxxxxxxxxxxx" as Did },
		state: "migratable",
	},
	{
		did: "did:plc:legacyfinchesxxxxxxxxxxxx" as Did,
		handle: "finches.colibri.social",
		name: "Finch Club",
		memberCount: 18,
		channelCount: 4,
		viewerIsAdmin: false,
		owner: {
			did: "did:plc:finchownerxxxxxxxxxxxxxx" as Did,
			handle: "finch.bsky.social",
		},
		state: "migratable",
	},
	{
		did: "did:plc:legacywrensxxxxxxxxxxxxxx" as Did,
		name: "Wren Corner",
		viewerIsAdmin: false,
		state: "blocked",
		blockedReason: "ownerRepo",
		owner: { did: "did:plc:wrenownerxxxxxxxxxxxxxxx" as Did },
	},
];

export const createMockLegacy = (input: {
	world: World;
	now: number;
	emit: (event: LiveEvent) => void;
	seed?: readonly LegacyCommunityView[];
}) => {
	const entries = (input.seed ?? []).map((entry) => ({ ...entry }));
	const timers = new Set<ReturnType<typeof setTimeout>>();

	const finish = (entry: LegacyCommunityView) => {
		const record = createCommunityRecord(
			input.world,
			{ name: entry.name, description: entry.description, did: entry.did },
			input.now,
		);
		record.view.migration = {
			at: asDatetime(input.now),
			by: input.world.viewerDid,
		};
		input.world.spaces.push(record);
		entries.splice(entries.indexOf(entry), 1);
		input.emit({
			$type: "communityEvent",
			event: "create",
			community: record.view,
		});
		input.emit({
			$type: "communityProgressEvent",
			step: "done",
			completed: MOCK_MIGRATION_STEPS.length,
			total: MOCK_MIGRATION_STEPS.length,
			community: entry.did,
		});
	};

	const run = (entry: LegacyCommunityView, index: number) => {
		if (index >= MOCK_MIGRATION_STEPS.length) {
			finish(entry);
			return;
		}
		const step = MOCK_MIGRATION_STEPS[index] as string;
		entry.progress = {
			step,
			completed: index,
			total: MOCK_MIGRATION_STEPS.length,
		};
		input.emit({
			$type: "communityProgressEvent",
			step,
			completed: index,
			total: MOCK_MIGRATION_STEPS.length,
			community: entry.did,
		});
		const timer = setTimeout(() => {
			timers.delete(timer);
			run(entry, index + 1);
		}, STEP_MS);
		timers.add(timer);
	};

	return {
		list: () => withLatency(() => entries.map((entry) => ({ ...entry }))),
		migrate: (community: Did) =>
			withLatency(() => {
				const entry = entries.find((candidate) => candidate.did === community);
				if (!entry) throw new Error("Unknown legacy community");
				if (entry.state === "blocked" || !entry.viewerIsAdmin) {
					throw new Error("Forbidden");
				}
				if (entry.state !== "migrating") {
					entry.state = "migrating";
					queueMicrotask(() => run(entry, 0));
				}
				return {
					...entry,
					progress: {
						step: MOCK_MIGRATION_STEPS[0],
						completed: 0,
						total: MOCK_MIGRATION_STEPS.length,
					},
				};
			}),
		stop: () => {
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
		},
	};
};

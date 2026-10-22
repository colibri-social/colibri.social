import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	batch,
	createEffect,
	createMemo,
	createRoot,
	createSignal,
	onCleanup,
} from "solid-js";
import type { DataSource } from "./source";
import type { Did, LegacyCommunityView, MigrationProgressView } from "./types";

const log = createLogger("legacy-communities");

export const LEGACY_POLL_MS = 15_000;

export const isLegacyBlocked = (community: LegacyCommunityView) =>
	community.state === "blocked";

export const isLegacyMigrating = (community: LegacyCommunityView) =>
	community.state === "migrating";

export const createLegacyCommunities = (input: {
	source: DataSource;
	onMigrated: (community: Did) => Promise<void>;
	pollMs?: number;
}) =>
	createRoot((dispose) => {
		const { source } = input;
		const [list, setList] = createSignal<LegacyCommunityView[]>();
		const [loading, setLoading] = createSignal(true);
		const [starting, setStarting] = createSignal<Did>();
		let generation = 0;

		const finished = (did: Did) => {
			void input.onMigrated(did).catch((thrown: unknown) =>
				log.warn("refreshing Spaces after a move failed", {
					code: classifyThrown(thrown).code,
				}),
			);
		};

		const refresh = async () => {
			const current = ++generation;
			const before = list() ?? [];
			try {
				const next = await source.listLegacyCommunities();
				if (current !== generation) return;
				const present = new Set(next.map((entry) => entry.did));
				batch(() => {
					setList(next);
					setLoading(false);
				});
				for (const entry of before) {
					if (isLegacyMigrating(entry) && !present.has(entry.did)) {
						finished(entry.did);
					}
				}
			} catch (thrown) {
				if (current !== generation) return;
				setLoading(false);
				log.warn("legacy communities failed to load", {
					code: classifyThrown(thrown, {
						method: "social.colibri.beta.community.listMigratable",
					}).code,
				});
			}
		};

		const patch = (
			did: Did,
			change: (entry: LegacyCommunityView) => LegacyCommunityView | undefined,
		) => {
			const current = list();
			if (!current) return;
			setList(
				current.flatMap((entry) => {
					if (entry.did !== did) return [entry];
					const next = change(entry);
					return next ? [next] : [];
				}),
			);
		};

		const unsubscribe = source.subscribe((event) => {
			if (event.$type !== "communityProgressEvent" || !event.community) return;
			const did = event.community;
			if (!list()?.some((entry) => entry.did === did)) return;
			if (event.step === "done") {
				patch(did, () => undefined);
				finished(did);
				return;
			}
			const failed = event.step === "failed";
			patch(did, (entry) => ({
				...entry,
				state: failed ? "migratable" : "migrating",
				progress: {
					step: failed ? (entry.progress?.step ?? event.step) : event.step,
					completed: event.completed,
					total: event.total,
					...(failed ? { failed: true } : {}),
				},
			}));
		});

		const anyMigrating = createMemo(
			() => list()?.some(isLegacyMigrating) ?? false,
		);
		createEffect(() => {
			if (!anyMigrating()) return;
			const timer = setInterval(
				() => void refresh(),
				input.pollMs ?? LEGACY_POLL_MS,
			);
			onCleanup(() => clearInterval(timer));
		});

		const dismissed = () =>
			source.preferences.client().dismissedLegacyCommunities;

		const visible = createMemo(() => {
			const hidden = new Set(dismissed());
			return (list() ?? []).filter(
				(entry) => !(isLegacyBlocked(entry) && hidden.has(entry.did)),
			);
		});

		const byDid = (did: string) => visible().find((entry) => entry.did === did);

		const migrate = async (did: Did) => {
			setStarting(did);
			try {
				const started = await source.migrateLegacyCommunity(did);
				patch(did, (entry) => ({
					...entry,
					...started,
					state: "migrating",
					progress: started.progress ?? startingProgress(entry),
				}));
			} finally {
				setStarting(undefined);
			}
		};

		const dismiss = (did: Did) => {
			const current = dismissed();
			if (current.includes(did)) return Promise.resolve(true);
			return source.preferences.setClient({
				dismissedLegacyCommunities: [...current, did],
			});
		};

		void refresh();

		return {
			list: visible,
			loading,
			starting,
			byDid,
			migrate,
			dismiss,
			refresh,
			dispose: () => {
				unsubscribe();
				dispose();
			},
		};
	});

const startingProgress = (
	entry: LegacyCommunityView,
): MigrationProgressView => ({
	step: "readingLegacyRepo",
	completed: entry.progress?.completed ?? 0,
	total: entry.progress?.total ?? 11,
});

export type LegacyCommunities = ReturnType<typeof createLegacyCommunities>;

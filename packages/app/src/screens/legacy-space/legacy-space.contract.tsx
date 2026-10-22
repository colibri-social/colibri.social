import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	IconButton,
	LegacySpace,
	type LegacySpaceVariant,
	toast,
} from "@colibri-social/ui";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { createEffect, createSignal, Show } from "solid-js";
import { describeError } from "../../data/error-copy";
import { spaceKey } from "../../data/ids";
import {
	isLegacyBlocked,
	isLegacyMigrating,
} from "../../data/legacy-communities";
import { useData } from "../../data/store";
import type { CommunityView, Did, LegacyCommunityView } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";

const log = createLogger("legacy-space");

export type LegacySpaceArgs = { did: string };

export const movedFrom = (
	community: Pick<CommunityView, "did" | "migratedFrom">,
	legacy: string,
) =>
	community.did === legacy ||
	community.migratedFrom?.startsWith(`at://${legacy}/`) === true;

export const variantOf = (
	entry: LegacyCommunityView,
	reviewing: boolean,
): LegacySpaceVariant => {
	if (isLegacyBlocked(entry)) return "blocked";
	if (isLegacyMigrating(entry)) return "moving";
	if (entry.progress?.failed) return "failed";
	if (!entry.viewerIsAdmin) return "waiting";
	return reviewing ? "review" : "migratable";
};

const migrateFailureCopy = (thrown: unknown) => {
	const code = classifyThrown(thrown, {
		method: "social.colibri.beta.community.migrate",
	}).code;
	if (code === "AlreadyExists") {
		return {
			title: "It already moved to Spaces",
			description: "Look for it in your Spaces.",
		};
	}
	return describeError(thrown);
};

export const legacySpace = defineContract({
	id: "legacySpace",
	model: (args: LegacySpaceArgs) => {
		const data = useData();
		const stack = useStack();
		const [reviewing, setReviewing] = createSignal(false);
		const [busy, setBusy] = createSignal(false);
		const [lastSeen, setLastSeen] = createSignal<LegacyCommunityView>();
		const live = () => data.legacy.byDid(args.did);
		const entry = (): LegacyCommunityView | undefined => {
			const current = live();
			if (current) return current;
			const previous = lastSeen();
			if (!previous || !isLegacyMigrating(previous)) return undefined;
			const total = previous.progress?.total ?? 0;
			return {
				...previous,
				progress: {
					step: "retiringLegacyCommunity",
					completed: total,
					total,
				},
			};
		};
		const variant = () => {
			const current = entry();
			return current ? variantOf(current, reviewing()) : undefined;
		};

		const close = () => {
			if (!busy()) stack.pop();
		};

		let opened = false;
		createEffect(() => {
			const current = live();
			if (current) {
				setLastSeen(current);
				return;
			}
			const moved = data.communities
				.value()
				?.find((community) => movedFrom(community, args.did));
			if (!lastSeen() || !moved || opened) return;
			opened = true;
			toast.success(`${moved.name} is on Spaces now`);
			stack.setRoot({ tab: "spaces", space: spaceKey(moved) });
			stack.popTo(0);
		});

		const migrate = async () => {
			const current = entry();
			if (!current || busy()) return;
			setBusy(true);
			try {
				await data.legacy.migrate(current.did as Did);
				setReviewing(false);
			} catch (thrown) {
				log.warn("starting a move failed", {
					code: classifyThrown(thrown).code,
				});
				const copy = migrateFailureCopy(thrown);
				toast.error(copy.title, { description: copy.description });
			} finally {
				setBusy(false);
			}
		};

		const dismiss = async () => {
			const current = entry();
			if (!current || busy()) return;
			setBusy(true);
			const saved = await data.legacy.dismiss(current.did as Did);
			setBusy(false);
			if (!saved) {
				toast.error("Colibri couldn't remove it", {
					description: "Give it another try in a moment.",
				});
				return;
			}
			stack.pop();
		};

		return {
			entry,
			variant,
			busy,
			close,
			review: () => setReviewing(true),
			back: () => setReviewing(false),
			migrate,
			retry: () => {
				const current = entry();
				if (current && isLegacyBlocked(current)) {
					void data.legacy.refresh();
					return;
				}
				void migrate();
			},
			dismiss,
		};
	},
	slots: {
		Header: slot((m) => (
			<div class="flex h-12 items-center p-2">
				<IconButton
					variant="ghost"
					size="md"
					label="Close"
					icon={<CloseIcon />}
					class="[&_svg]:size-6"
					disabled={m.busy()}
					onClick={m.close}
				/>
			</div>
		)),
		Body: slot((m, props: { showTitle?: boolean; class?: string }) => (
			<Show
				when={m.entry()}
				fallback={
					<LegacySpace
						variant="blocked"
						blockedReason="unreadable"
						name="This community"
						showTitle={props.showTitle}
						class={props.class}
						onDismiss={m.close}
					/>
				}
			>
				{(entry) => (
					<LegacySpace
						variant={m.variant() ?? "waiting"}
						name={entry().name}
						iconSrc={entry().picture}
						ownerHandle={entry().owner?.handle}
						memberCount={entry().memberCount}
						channelCount={entry().channelCount}
						blockedReason={entry().blockedReason}
						progress={entry().progress}
						busy={m.busy()}
						showTitle={props.showTitle}
						class={props.class}
						onReview={m.review}
						onBack={m.back}
						onMigrate={() => void m.migrate()}
						onRetry={m.retry}
						onDismiss={() => void m.dismiss()}
						onClose={m.close}
					/>
				)}
			</Show>
		)),
	},
});

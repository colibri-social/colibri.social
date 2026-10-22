import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Spinner } from "../Spinner/Spinner";
import { SpaceIcon } from "./SpaceIcon";

export const LEGACY_MIGRATION_STEPS = [
	{ id: "readingLegacyRepo", label: "Reading your community" },
	{ id: "creatingSpaces", label: "Setting up the Space" },
	{ id: "writingProfile", label: "Copying the name and picture" },
	{ id: "writingSettings", label: "Copying settings" },
	{ id: "migratingRoles", label: "Copying roles" },
	{ id: "migratingMembers", label: "Adding members" },
	{ id: "migratingBans", label: "Copying bans" },
	{ id: "migratingChannels", label: "Creating channels" },
	{ id: "migratingCategories", label: "Arranging categories" },
	{ id: "mirroringMessages", label: "Bringing over message history" },
	{ id: "retiringLegacyCommunity", label: "Finishing up" },
] as const;

export type LegacySpaceVariant =
	| "waiting"
	| "migratable"
	| "review"
	| "moving"
	| "failed"
	| "blocked";

export type LegacyBlockedReason = "ownerRepo" | "unreadable" | "noAdmin";

export type LegacySpaceProgress = {
	step: string;
	completed: number;
};

export type LegacySpaceProps = {
	variant: LegacySpaceVariant;
	name: string;
	iconSrc?: string;
	ownerHandle?: string;
	memberCount?: number;
	channelCount?: number;
	blockedReason?: LegacyBlockedReason | (string & {});
	progress?: LegacySpaceProgress;
	busy?: boolean;
	onReview?: () => void;
	onBack?: () => void;
	onMigrate?: () => void;
	onRetry?: () => void;
	onDismiss?: () => void;
	onClose?: () => void;
	showTitle?: boolean;
	class?: string;
};

export const legacySpaceTitle = (variant: LegacySpaceVariant, name: string) => {
	if (variant === "waiting") return `${name} isn't on Spaces yet`;
	if (variant === "moving") return `Moving ${name}`;
	if (variant === "failed") return "The move stopped partway";
	if (variant === "blocked") return `${name} can't move to Spaces`;
	return `Move ${name} to Spaces`;
};

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

const blockedCopy = (reason: string | undefined): string => {
	if (reason === "ownerRepo") {
		return "This community was made with an early version of Colibri, so it can't move to Spaces.";
	}
	if (reason === "noAdmin") {
		return "Nobody who can move this community is still in it, so it can't move to Spaces.";
	}
	return "Colibri can't reach this community right now. Try again in a little while.";
};

const stepIndex = (step: string | undefined) =>
	LEGACY_MIGRATION_STEPS.findIndex((entry) => entry.id === step);

const Heading = (props: {
	name: string;
	iconSrc?: string;
	title?: string;
	description: JSX.Element;
}) => (
	<div class="flex flex-col items-center gap-3 text-center">
		<SpaceIcon
			name={props.name}
			src={props.iconSrc}
			size={64}
			class="size-16 rounded-control opacity-60"
		/>
		<Show when={props.title}>
			<h2
				data-legacy-title=""
				class="m-0 font-semibold text-foreground text-lg"
			>
				{props.title}
			</h2>
		</Show>
		<p class="m-0 max-w-sm text-pretty text-muted-foreground text-sm">
			{props.description}
		</p>
	</div>
);

const ReviewList = (props: {
	title: string;
	items: string[];
	moves: boolean;
}) => (
	<div class="flex w-full flex-col gap-2">
		<h3 class="m-0 font-medium text-foreground text-sm">{props.title}</h3>
		<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
			<For each={props.items}>
				{(item) => (
					<li class="flex items-start gap-2 text-muted-foreground text-sm">
						<span
							aria-hidden="true"
							class={cx(
								"mt-px flex shrink-0 [&>svg]:size-4",
								props.moves ? "text-primary" : "text-muted-foreground",
							)}
						>
							<Show when={props.moves} fallback={<CloseCircleIcon />}>
								<CheckCircleIcon />
							</Show>
						</span>
						<span>{item}</span>
					</li>
				)}
			</For>
		</ul>
	</div>
);

const StepList = (props: { progress?: LegacySpaceProgress }) => {
	const current = () => stepIndex(props.progress?.step);
	const total = LEGACY_MIGRATION_STEPS.length;
	const done = () => Math.min(props.progress?.completed ?? 0, total);
	return (
		<div class="flex w-full flex-col gap-3">
			<div
				role="progressbar"
				aria-label="Move progress"
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={done()}
				class="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
			>
				<div
					data-legacy-progress=""
					class="h-full rounded-full bg-primary transition-[width] duration-[calc(240ms*var(--motion-scale))] motion-reduce:transition-none reduced-motion:transition-none"
					style={{ width: `${(done() / total) * 100}%` }}
				/>
			</div>
			<ol class="m-0 flex list-none flex-col gap-1.5 p-0">
				<For each={LEGACY_MIGRATION_STEPS}>
					{(step, index) => {
						const state = () =>
							index() < current()
								? "done"
								: index() === current()
									? "active"
									: "pending";
						return (
							<li
								data-legacy-step={state()}
								class={cx(
									"flex items-center gap-2 text-sm",
									state() === "pending"
										? "text-muted-foreground"
										: "text-foreground",
								)}
							>
								<span
									aria-hidden="true"
									class="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4"
								>
									<Switch
										fallback={
											<span class="size-1.5 rounded-full bg-muted-foreground/50" />
										}
									>
										<Match when={state() === "done"}>
											<CheckCircleIcon class="text-primary" />
										</Match>
										<Match when={state() === "active"}>
											<Spinner size={16} />
										</Match>
									</Switch>
								</span>
								<span>{step.label}</span>
							</li>
						);
					}}
				</For>
			</ol>
		</div>
	);
};

export const LegacySpace = (props: LegacySpaceProps) => {
	const title = () =>
		props.showTitle === false
			? undefined
			: legacySpaceTitle(props.variant, props.name);
	const counts = () => {
		const parts: string[] = [];
		if (props.channelCount !== undefined)
			parts.push(plural(props.channelCount, "channel", "channels"));
		if (props.memberCount !== undefined)
			parts.push(plural(props.memberCount, "member", "members"));
		return parts;
	};

	return (
		<div
			data-legacy-space={props.variant}
			class={cx(
				"flex w-full flex-col items-center gap-6 px-6 py-8",
				props.class,
			)}
		>
			<Switch>
				<Match when={props.variant === "waiting"}>
					<Heading
						name={props.name}
						iconSrc={props.iconSrc}
						title={title()}
						description={
							<>
								<Show
									when={props.ownerHandle}
									fallback="Ask the owner to move it to Spaces."
								>
									{(handle) => (
										<>
											Ask{" "}
											<span class="font-medium text-foreground">
												@{handle()}
											</span>{" "}
											to move it to Spaces.
										</>
									)}
								</Show>{" "}
								It shows up here with its channels and history once it moves.
							</>
						}
					/>
					<Show when={props.onClose}>
						<Button block variant="secondary" onClick={() => props.onClose?.()}>
							Close
						</Button>
					</Show>
				</Match>
				<Match when={props.variant === "migratable"}>
					<Heading
						name={props.name}
						iconSrc={props.iconSrc}
						title={title()}
						description="Your community is still on the old version of Colibri. Move it to Spaces so everyone can keep chatting here."
					/>
					<div class="flex w-full flex-col gap-2">
						<Button block onClick={() => props.onReview?.()}>
							Review the move
						</Button>
						<Show when={props.onClose}>
							<Button
								block
								variant="secondary"
								onClick={() => props.onClose?.()}
							>
								Not now
							</Button>
						</Show>
					</div>
				</Match>
				<Match when={props.variant === "review"}>
					<Heading
						name={props.name}
						iconSrc={props.iconSrc}
						title={title()}
						description="Everything below moves in one go. Members join the Space automatically with their roles."
					/>
					<ReviewList
						title="Moves over"
						moves
						items={[
							counts().length > 0
								? `Channels, categories and members (${counts().join(", ")})`
								: "Channels, categories and members",
							"Roles and who can post where",
							"Bans",
							"Message history from current members, as read-only messages",
						]}
					/>
					<ReviewList
						title="Stays behind"
						moves={false}
						items={[
							"Invite links. Create new ones in the Space.",
							"Pending join requests",
							"Messages from people who left",
						]}
					/>
					<div class="flex w-full flex-col gap-2">
						<Button
							block
							loading={props.busy}
							disabled={props.busy}
							onClick={() => props.onMigrate?.()}
						>
							Move to Spaces
						</Button>
						<Button
							block
							variant="secondary"
							disabled={props.busy}
							onClick={() => props.onBack?.()}
						>
							Back
						</Button>
					</div>
				</Match>
				<Match when={props.variant === "moving"}>
					<Heading
						name={props.name}
						iconSrc={props.iconSrc}
						title={title()}
						description="You can close this. The move keeps going, and the Space appears in your sidebar when it's done."
					/>
					<StepList progress={props.progress} />
					<Show when={props.onClose}>
						<Button block variant="secondary" onClick={() => props.onClose?.()}>
							Close
						</Button>
					</Show>
				</Match>
				<Match when={props.variant === "failed"}>
					<Heading
						name={props.name}
						iconSrc={props.iconSrc}
						title={title()}
						description="Nothing is lost. Try again to continue where it stopped."
					/>
					<StepList progress={props.progress} />
					<div class="flex w-full flex-col gap-2">
						<Button
							block
							loading={props.busy}
							disabled={props.busy}
							onClick={() => props.onRetry?.()}
						>
							Try again
						</Button>
						<Show when={props.onClose}>
							<Button
								block
								variant="secondary"
								disabled={props.busy}
								onClick={() => props.onClose?.()}
							>
								Close
							</Button>
						</Show>
					</div>
				</Match>
				<Match when={props.variant === "blocked"}>
					<Heading
						name={props.name}
						iconSrc={props.iconSrc}
						title={title()}
						description={blockedCopy(props.blockedReason)}
					/>
					<div class="flex w-full flex-col gap-2">
						<Show when={props.blockedReason === "unreadable" && props.onRetry}>
							<Button block onClick={() => props.onRetry?.()}>
								Try again
							</Button>
						</Show>
						<Button
							block
							variant="destructive-subtle"
							disabled={props.busy}
							onClick={() => props.onDismiss?.()}
						>
							Remove from sidebar
						</Button>
					</div>
				</Match>
			</Switch>
		</div>
	);
};

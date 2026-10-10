import { ClockCircleIcon } from "@solar-icons/solid/bold/clock-circle";
import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createEffect,
	createSignal,
	createUniqueId,
	Match,
	on,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { Banner } from "../Banner/Banner";
import { Button } from "../Button/Button";
import { SpaceIcon } from "../Space/SpaceIcon";
import { MemberCountChip, OwnerChip } from "../Space/SpaceMeta";
import { SpaceProfileHeader } from "../Space/SpaceProfileHeader";
import {
	type DiscoveryActions,
	type DiscoverySpace,
	dispatchJoinAction,
	joinNote,
	memberSummary,
} from "./discovery-model";

export type JoinSpaceActionProps = DiscoveryActions & {
	space: DiscoverySpace;
	busy?: boolean;
	layout?: "inline" | "stacked";
	class?: string;
};

export const JoinSpaceAction = (props: JoinSpaceActionProps) => {
	const noteId = createUniqueId();
	const [announcement, setAnnouncement] = createSignal("");
	let container: HTMLDivElement | undefined;
	let keepFocus = false;
	const note = () => joinNote(props.space);
	const describedBy = () => (note() ? noteId : undefined);
	const block = () => props.layout === "stacked";

	createEffect(
		on(
			() => props.space.viewer,
			(viewer) => {
				if (viewer === "member")
					setAnnouncement(`You joined ${props.space.name}`);
				if (viewer === "pending")
					setAnnouncement(`Request to join ${props.space.name} sent`);
				if (!keepFocus || !container) return;
				keepFocus = false;
				const target =
					container.querySelector<HTMLElement>("button:not(:disabled)") ??
					container;
				target.focus({ preventScroll: true });
			},
			{ defer: true },
		),
	);

	const act = () => {
		if (props.busy) return;
		keepFocus = props.space.viewer !== "member";
		dispatchJoinAction(props.space, props);
	};

	return (
		<div
			ref={container}
			tabIndex={-1}
			data-join-action={props.space.viewer}
			class={cx(
				"flex gap-x-3 gap-y-2 outline-none",
				block() ? "flex-col" : "flex-wrap items-center",
				props.class,
			)}
		>
			<Switch>
				<Match when={props.space.viewer === "member"}>
					<Button variant="primary" block={block()} onClick={act}>
						Open Space
					</Button>
				</Match>
				<Match when={props.space.viewer === "pending"}>
					<Button
						variant="secondary"
						block={block()}
						disabled
						aria-describedby={describedBy()}
					>
						Request pending
					</Button>
				</Match>
				<Match when={props.space.viewer === "none"}>
					<Button
						variant="primary"
						block={block()}
						loading={props.busy}
						aria-describedby={describedBy()}
						haptic="light"
						onClick={act}
					>
						{props.space.joinMode === "approval"
							? "Request to join"
							: "Join Space"}
					</Button>
				</Match>
			</Switch>
			<Show when={note()}>
				{(text) => (
					<p
						id={noteId}
						data-join-note=""
						class="flex min-w-0 items-start gap-1.5 text-sm text-pretty text-muted-foreground"
					>
						<span
							aria-hidden="true"
							class="flex h-5 shrink-0 items-center [&>svg]:size-4"
						>
							<Show
								when={props.space.viewer === "pending"}
								fallback={<LockKeyholeMinimalisticIcon />}
							>
								<ClockCircleIcon />
							</Show>
						</span>
						<span>{text()}</span>
					</p>
				)}
			</Show>
			<span role="status" class="sr-only">
				{announcement()}
			</span>
		</div>
	);
};

export type SpacePreviewProps = DiscoveryActions & {
	space: DiscoverySpace;
	busy?: boolean;
	onBack: () => void;
	backLabel?: string;
	class?: string;
};

export const SpacePreview = (props: SpacePreviewProps) => {
	const nameId = createUniqueId();
	let section: HTMLElement | undefined;
	onMount(() =>
		requestAnimationFrame(() => section?.focus({ preventScroll: false })),
	);

	return (
		<section
			ref={section}
			tabIndex={-1}
			aria-labelledby={nameId}
			data-space-preview={props.space.id}
			class={cx(
				"mx-auto flex w-full max-w-[720px] flex-col gap-4 outline-none",
				props.class,
			)}
			onKeyDown={(event) => {
				const back =
					event.key === "Escape" || (event.altKey && event.key === "ArrowLeft");
				if (!back) return;
				event.preventDefault();
				event.stopPropagation();
				props.onBack();
			}}
		>
			<div>
				<Button
					variant="tertiary"
					icon={<ArrowLeftIcon />}
					class="-ml-2 pr-3 pl-3"
					onClick={props.onBack}
				>
					{props.backLabel ?? "Back to Spaces"}
				</Button>
			</div>
			<article class="overflow-hidden rounded-surface border border-border bg-card">
				<Banner
					src={props.space.bannerSrc}
					tintFrom={props.space.iconSrc}
					color={props.space.bannerColor}
					class="aspect-[4/1]"
				/>
				<div class="flex flex-col gap-4 px-4 pb-5">
					<SpaceIcon
						name={props.space.name}
						src={props.space.iconSrc}
						size={64}
						class="-mt-8 border-4 border-card"
					/>
					<div class="flex min-w-0 flex-col gap-2">
						<div class="flex min-w-0 flex-col gap-0.5">
							<h2
								id={nameId}
								title={props.space.name}
								class="truncate text-2xl leading-tight font-bold text-foreground"
							>
								{props.space.name}
							</h2>
							<Show when={props.space.handle}>
								{(handle) => (
									<span class="truncate text-sm text-muted-foreground select-text">
										{`@${handle()}`}
									</span>
								)}
							</Show>
						</div>
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							<MemberCountChip
								count={props.space.memberCount}
								label={memberSummary(props.space)}
							/>
							<Show when={props.space.ownerHandle}>
								{(handle) => <OwnerChip handle={handle()} />}
							</Show>
						</div>
					</div>
					<Show when={props.space.description}>
						<p class="max-w-[65ch] text-base text-pretty text-muted-foreground select-text">
							{props.space.description}
						</p>
					</Show>
					<JoinSpaceAction
						space={props.space}
						busy={props.busy}
						onJoin={props.onJoin}
						onRequestJoin={props.onRequestJoin}
						onOpenSpace={props.onOpenSpace}
						class="pt-1"
					/>
				</div>
			</article>
		</section>
	);
};

export type SpacePreviewHeaderProps = DiscoveryActions & {
	space: DiscoverySpace;
	busy?: boolean;
	nameId?: string;
};

export const SpacePreviewHeader = (props: SpacePreviewHeaderProps) => (
	<SpaceProfileHeader
		name={props.space.name}
		nameId={props.nameId}
		iconSrc={props.space.iconSrc}
		bannerSrc={props.space.bannerSrc}
		bannerColor={props.space.bannerColor}
		memberCount={props.space.memberCount}
		memberLabel={memberSummary(props.space)}
		ownerHandle={props.space.ownerHandle}
		description={props.space.description}
		actions={
			<JoinSpaceAction
				space={props.space}
				busy={props.busy}
				layout="stacked"
				onJoin={props.onJoin}
				onRequestJoin={props.onRequestJoin}
				onOpenSpace={props.onOpenSpace}
			/>
		}
	/>
);

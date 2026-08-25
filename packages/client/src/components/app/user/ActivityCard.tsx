import { type Component, createSignal, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import BroadcastIcon from "~icons/ph/broadcast";
import GameControllerIcon from "~icons/ph/game-controller-fill";
import MusicNoteIcon from "~icons/ph/music-note-fill";
import { activityLabel } from "../../../atproto/activity";
import type { Activity, ActivityKind } from "../../../atproto/views";
import { openUntrustedLink } from "../../../utils/external-link-warning";

const KIND_ICONS: Record<ActivityKind, Component> = {
	listening: MusicNoteIcon,
	playing: GameControllerIcon,
	streaming: BroadcastIcon,
};

export const ActivityIcon: Component<{ kind: Activity["kind"] }> = (props) => (
	<Dynamic
		component={KIND_ICONS[props.kind as ActivityKind] ?? MusicNoteIcon}
	/>
);

const ActivityArtwork: Component<{ activity: Activity }> = (props) => {
	const [failed, setFailed] = createSignal(false);

	return (
		<div class="relative size-16 shrink-0 rounded-sm bg-muted overflow-hidden flex items-center justify-center">
			<span class="text-2xl text-purple-400">
				<ActivityIcon kind={props.activity.kind} />
			</span>
			<Show when={props.activity.imageUri && !failed()}>
				<img
					src={props.activity.imageUri}
					alt={props.activity.detail ?? props.activity.title}
					loading="lazy"
					decoding="async"
					width={64}
					height={64}
					class="absolute inset-0 w-full h-full object-cover"
					onError={() => setFailed(true)}
				/>
			</Show>
		</div>
	);
};

export const ActivityCard: Component<{ activity: Activity }> = (props) => {
	const body = () => (
		<>
			<ActivityArtwork activity={props.activity} />
			<div class="flex flex-col min-w-0 gap-0.5">
				<span class="text-sm font-bold leading-5 truncate">
					{props.activity.title}
				</span>
				<Show when={props.activity.subtitle}>
					<span class="text-xs text-muted-foreground leading-4 truncate">
						{props.activity.subtitle}
					</span>
				</Show>
				<Show when={props.activity.detail}>
					<span class="text-xs text-muted-foreground leading-4 truncate">
						on {props.activity.detail}
					</span>
				</Show>
			</div>
		</>
	);

	return (
		<div class="flex flex-col gap-1.5 px-1">
			<span class="text-[0.6875rem] font-bold tracking-wide uppercase text-muted-foreground">
				{activityLabel(props.activity)}
			</span>
			<Show
				when={props.activity.linkUri}
				fallback={<div class="flex flex-row gap-3">{body()}</div>}
			>
				<a
					href={props.activity.linkUri}
					target="_blank"
					rel="noreferrer"
					onClick={(e) => openUntrustedLink(props.activity.linkUri, e)}
					class="relative flex flex-row gap-3 rounded-sm items-center hover:bg-muted/50 focus-visible:bg-muted/50 no-underline text-inherit"
				>
					{body()}
				</a>
			</Show>
		</div>
	);
};

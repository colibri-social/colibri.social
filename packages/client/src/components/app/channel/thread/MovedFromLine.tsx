import { type Component, Show } from "solid-js";
import ArrowRightIcon from "~icons/ph/arrow-right";
import { useCommunityContext } from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";
import { formatCompactAge } from "../../../../utils/format-timestamp";
import { useNow } from "../../../../utils/now";

export const MovedFromLine: Component<{ origin: string; createdAt: string }> = (
	props,
) => {
	const community = useCommunityContext();
	const threads = useThreads();
	const now = useNow();

	const originName = () =>
		community().channels.find((channel) => channel.space === props.origin)
			?.name ?? threads.bySpace(props.origin)?.name;

	return (
		<Show when={originName()}>
			{(name) => (
				<span class="ml-14 flex flex-row items-center gap-1 text-xs text-muted-foreground">
					<ArrowRightIcon class="size-3 shrink-0" />
					written {formatCompactAge(props.createdAt, new Date(now()))} ago in{" "}
					{name()}
				</span>
			)}
		</Show>
	);
};

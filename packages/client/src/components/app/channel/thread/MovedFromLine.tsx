import { type Component, Show } from "solid-js";
import ArrowRightIcon from "~icons/ph/arrow-right";
import { useCommunityContext } from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";

export const MovedFromLine: Component<{ origin: string }> = (props) => {
	const community = useCommunityContext();
	const threads = useThreads();

	const originName = () =>
		community().channels.find((channel) => channel.space === props.origin)
			?.name ?? threads.bySpace(props.origin)?.name;

	return (
		<Show when={originName()}>
			{(name) => (
				<span class="ml-14 flex flex-row items-center gap-1 text-xs text-muted-foreground">
					<ArrowRightIcon class="size-3 shrink-0" />
					moved from {name()}
				</span>
			)}
		</Show>
	);
};

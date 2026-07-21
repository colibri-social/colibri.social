import twemoji from "@twemoji/api";
import { type Component, Show } from "solid-js";
import PlusIcon from "~icons/ph/plus";
import { useUserContext } from "../../../contexts/User";

export const SelfStatusEditor: Component<{ onEditRequested: () => void }> = (
	props,
) => {
	const user = useUserContext();

	const hasStatus = () =>
		(user.data.status?.text?.length ?? 0) > 0 ||
		(user.data.status?.emoji?.length ?? 0) > 0;

	return (
		<button
			type="button"
			class="flex flex-row items-center gap-1.5 bg-card border border-border rounded-sm px-1.5 py-0.5 drop-shadow-black drop-shadow-sm max-w-48 overflow-hidden cursor-pointer hover:bg-muted/50"
			onClick={props.onEditRequested}
		>
			<Show
				when={hasStatus()}
				fallback={
					<>
						<PlusIcon class="w-4 h-4 shrink-0 text-muted-foreground" />
						<span class="text-sm text-muted-foreground italic">
							Set a status
						</span>
					</>
				}
			>
				<Show when={user.data.status?.emoji}>
					<span
						class="h-5.5 w-5.5 [&>img]:min-w-4.5 [&>img]:min-h-4.5 [&>img]:w-4.5 [&>img]:h-4.5 [&>img]inline flex items-center justify-center"
						innerHTML={twemoji.parse(user.data.status!.emoji!)}
					/>
				</Show>
				<span class="leading-5.5 text-sm w-fit truncate">
					{user.data.status?.text}
				</span>
			</Show>
		</button>
	);
};

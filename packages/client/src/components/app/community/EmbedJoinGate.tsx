import { type Component, Show } from "solid-js";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";

export const EmbedJoinGate: Component<{
	name?: string;
	gated?: boolean;
	busy?: boolean;
	onJoin: () => void;
}> = (props) => (
	<div class="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center select-none">
		<p class="text-base font-medium m-0">
			{props.name
				? `You're not a member of ${props.name} yet.`
				: "You're not a member of this community yet."}
		</p>
		<p class="text-sm text-muted-foreground m-0">
			<Show
				when={props.gated}
				fallback="Join to read along and take part in the conversation."
			>
				This community approves members by hand. Ask to join and someone will
				take a look.
			</Show>
		</p>
		<Button onClick={() => props.onJoin()} disabled={props.busy} class="gap-2">
			<Show when={props.busy}>
				<Spinner />
			</Show>
			<Show when={props.gated} fallback="Join community">
				Request to join
			</Show>
		</Button>
	</div>
);

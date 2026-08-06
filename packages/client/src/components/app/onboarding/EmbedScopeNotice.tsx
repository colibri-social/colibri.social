import { type Component, For, onMount } from "solid-js";
import { scopeSetLabel } from "../../../atproto/scopes";
import { useEmbedEmitter } from "../../../embed/context";
import { createLogger } from "../../../utils/logger";

const log = createLogger("scopes");

export const EmbedScopeNotice: Component<{ missing: Array<string> }> = (
	props,
) => {
	const emitter = useEmbedEmitter();

	const labels = () => [...new Set(props.missing.map(scopeSetLabel))];

	onMount(() => {
		log.warn("the embedded session is missing permissions", {
			missing: props.missing.length,
		});
		emitter?.emit({ kind: "scopes.missing", missing: props.missing });
	});

	return (
		<div class="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center select-none">
			<p class="text-base font-medium m-0">
				This chat needs more permissions than it was given.
			</p>
			<p class="text-sm text-muted-foreground m-0">
				Whoever added it to this page has to ask for these when signing you in:
			</p>
			<ul class="text-sm text-muted-foreground list-none p-0 m-0 flex flex-col gap-1">
				<For each={labels()}>{(label) => <li class="m-0">{label}</li>}</For>
			</ul>
		</div>
	);
};

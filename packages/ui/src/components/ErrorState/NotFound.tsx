import { CompassIcon } from "@solar-icons/solid/bold/compass";
import { type JSX, Show } from "solid-js";
import { Button } from "../Button/Button";
import { StatusScreen } from "../StatusScreen/StatusScreen";

export type NotFoundProps = {
	title?: JSX.Element;
	description?: JSX.Element;
	path?: string;
	actionLabel?: string;
	onAction?: () => void;
	class?: string;
};

export const NotFound = (props: NotFoundProps) => (
	<StatusScreen
		tone="neutral"
		icon={<CompassIcon />}
		title={props.title ?? "Page not found"}
		description={
			<>
				<span class="block">
					{props.description ??
						"This link doesn't lead anywhere in Colibri. It may be mistyped, or the page moved."}
				</span>
				<Show when={props.path}>
					{(path) => (
						<span
							data-not-found-path=""
							class="mt-1 block font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground"
						>
							{path()}
						</span>
					)}
				</Show>
			</>
		}
		actions={
			props.onAction ? (
				<Button block variant="secondary" onClick={() => props.onAction?.()}>
					{props.actionLabel ?? "Go to Spaces"}
				</Button>
			) : undefined
		}
		class={props.class}
	/>
);

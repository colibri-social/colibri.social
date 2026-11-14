import { GlobeIcon } from "@solar-icons/solid/bold/globe";
import { type JSX, Show } from "solid-js";
import { AtprotoAtLogo, PdslsLogo } from "../../icons/animated/brand";
import {
	type RecordExplorer,
	type RecordExplorerChoice,
	resolveRecordExplorer,
} from "./record-explorer-links";

export * from "./record-explorer-links";

const LOGOS: Record<
	RecordExplorer,
	(props: { class?: string }) => JSX.Element
> = {
	pdsls: (props) => <PdslsLogo class={props.class} />,
	atprotoAt: (props) => <AtprotoAtLogo class={props.class} />,
};

export const RecordExplorerLogo = (props: {
	explorer?: RecordExplorerChoice;
	class?: string;
}) => {
	const explorer = () => {
		if (props.explorer === "custom") return undefined;

		const resolved = resolveRecordExplorer(props.explorer);

		return resolved === "custom" ? undefined : resolved;
	};

	return (
		<Show when={explorer()} keyed fallback={<GlobeIcon class={props.class} />}>
			{(id) => LOGOS[id](props)}
		</Show>
	);
};

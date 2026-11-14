import { createSignal, type JSX } from "solid-js";
import { AtprotoAtLogo, PdslsLogo } from "../../icons/animated/brand";

export const RECORD_EXPLORER_IDS = ["pdsls", "atprotoAt"] as const;

export type RecordExplorer = (typeof RECORD_EXPLORER_IDS)[number];

type ExplorerHref = {
	(
		value: `did:${string}` | `at://${string}`,
		explorer?: RecordExplorer,
	): string;
	(value: string | undefined, explorer?: RecordExplorer): string | undefined;
};

type ExplorerSite = {
	name: string;
	logo: (props: { class?: string }) => JSX.Element;
	href: (identifier: string) => string;
};

export const RECORD_EXPLORERS: Record<RecordExplorer, ExplorerSite> = {
	pdsls: {
		name: "PDSls",
		logo: (props) => <PdslsLogo class={props.class} />,
		href: (identifier) => `https://pdsls.dev/${identifier}`,
	},
	atprotoAt: {
		name: "atproto.at",
		logo: (props) => <AtprotoAtLogo class={props.class} />,
		href: (identifier) =>
			`https://atproto.at/uri/${identifier.replace(/^at:\/\//, "")}`,
	},
};

const [activeExplorer, setActiveExplorer] =
	createSignal<RecordExplorer>("pdsls");

export const isRecordExplorer = (value: unknown): value is RecordExplorer => {
	return (
		typeof value === "string" &&
		(RECORD_EXPLORER_IDS as readonly string[]).includes(value)
	);
};

export const recordExplorer = () => {
	return activeExplorer();
};

export const setRecordExplorer = (explorer: RecordExplorer) => {
	setActiveExplorer(explorer);
};

export const recordExplorerName = (explorer = activeExplorer()) => {
	return RECORD_EXPLORERS[explorer].name;
};

export const showInExplorerLabel = (explorer = activeExplorer()) => {
	return `Show on ${recordExplorerName(explorer)}`;
};

export const RecordExplorerLogo = (props: {
	explorer?: RecordExplorer;
	class?: string;
}) => {
	return (
		<>{RECORD_EXPLORERS[props.explorer ?? activeExplorer()].logo(props)}</>
	);
};

const explorerHrefOf = (
	value: string | undefined,
	explorer = activeExplorer(),
) => {
	if (!value) return undefined;
	if (value.startsWith("at://")) return RECORD_EXPLORERS[explorer].href(value);
	if (value.startsWith("did:")) {
		return RECORD_EXPLORERS[explorer].href(`at://${value}`);
	}
	return undefined;
};

export const recordExplorerHref = explorerHrefOf as ExplorerHref;

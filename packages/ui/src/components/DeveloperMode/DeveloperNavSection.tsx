import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { Show } from "solid-js";
import { SidebarNavItem, SidebarNavSection } from "../List/List";
import { createCopied } from "../SettingsPages/shared";
import {
	RecordExplorerLogo,
	recordExplorerHref,
	showInExplorerLabel,
} from "./record-explorer";

export type DeveloperNavSectionProps = {
	copyLabel?: string;
	copyValue: string;
	explorerHref?: string;
	explorerLabel?: string;
	class?: string;
};

export const DeveloperNavSection = (props: DeveloperNavSectionProps) => {
	const { copied, copy } = createCopied();
	const explorerHref = () =>
		props.explorerHref ?? recordExplorerHref(props.copyValue);
	return (
		<SidebarNavSection label="Developer mode" class={props.class}>
			<SidebarNavItem
				icon={
					copied() ? <CheckCircleIcon class="text-success" /> : <CopyIcon />
				}
				label={props.copyLabel ?? "Copy AT-URI"}
				onClick={(event) =>
					void copy(props.copyValue, event.currentTarget as HTMLElement)
				}
			/>
			<Show when={explorerHref()}>
				{(href) => (
					<SidebarNavItem
						icon={<RecordExplorerLogo />}
						label={props.explorerLabel ?? showInExplorerLabel()}
						href={href()}
						external
					/>
				)}
			</Show>
			<span role="status" class="sr-only">
				{copied() ? "Copied" : ""}
			</span>
		</SidebarNavSection>
	);
};

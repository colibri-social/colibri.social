import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { Show } from "solid-js";
import { PdslsLogo } from "../../icons/animated/brand";
import { SidebarNavItem, SidebarNavSection } from "../List/List";
import { createCopied } from "../SettingsPages/shared";
import { pdslsHrefFor } from "./DeveloperModeCard";

export type DeveloperNavSectionProps = {
	copyLabel?: string;
	copyValue: string;
	pdslsHref?: string;
	pdslsLabel?: string;
	class?: string;
};

export const DeveloperNavSection = (props: DeveloperNavSectionProps) => {
	const { copied, copy } = createCopied();
	const pdslsHref = () => props.pdslsHref ?? pdslsHrefFor(props.copyValue);
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
			<Show when={pdslsHref()}>
				{(href) => (
					<SidebarNavItem
						icon={<PdslsLogo />}
						label={props.pdslsLabel ?? "Show on PDSls"}
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

import { SidebarNavItem, SidebarNavSection } from "@colibri-social/ui";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { batch, Show } from "solid-js";
import type { ModalAreaProps } from "../../../shell/desktop/modal-areas";
import type { AdminLayer, AdminPage } from "../../../shell/layers";
import { useStack } from "../../../shell/stack";
import { parseEntryId } from "../channel/channel-target";
import { AdminModalFrame } from "./modal-frame";
import { adminPageLabel } from "./page-labels";

type Section = "general" | "permissions";

const NESTED: readonly string[] = ["permissions", "audience"];

export default function ChannelSettingsModal(props: ModalAreaProps) {
	const stack = useStack();
	const pages = () => props.layers as AdminLayer[];
	const root = () => pages()[0] as AdminLayer;
	const kind = () =>
		root().page.startsWith("category") ? "category" : "channel";
	const settingsRoot = () => root().page === kind();
	const creating = () => parseEntryId(root().id).creating;
	const active = (): Section =>
		pages().some((layer) =>
			NESTED.some((suffix) => layer.page.endsWith(`-${suffix}`)),
		)
			? "permissions"
			: "general";
	const select = (section: Section) => {
		if (section === active()) {
			if (section === "permissions" && pages().length > 2) {
				stack.popTo(props.depth + 2);
			}
			return;
		}
		batch(() => {
			if (section === "general") {
				stack.popTo(props.depth + 1);
				return;
			}
			stack.push({
				kind: "admin",
				space: root().space,
				page: `${kind()}-permissions` as AdminPage,
				id: root().id ?? "",
			});
		});
	};
	const label = () =>
		kind() === "category" ? "Category settings" : "Channel settings";
	return (
		<AdminModalFrame
			pages={pages()}
			baseDepth={props.depth}
			fallbackTitle={label()}
			label={adminPageLabel}
			rootBack
			sidebar={
				<Show when={settingsRoot() && !creating()}>
					<SidebarNavSection label={label()}>
						<SidebarNavItem
							label="General"
							icon={<SettingsIcon />}
							active={active() === "general"}
							onClick={() => select("general")}
						/>
						<SidebarNavItem
							label="Permissions"
							icon={<ShieldUserIcon />}
							active={active() === "permissions"}
							onClick={() => select("permissions")}
						/>
					</SidebarNavSection>
				</Show>
			}
		/>
	);
}

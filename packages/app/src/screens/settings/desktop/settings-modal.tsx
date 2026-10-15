import {
	LargeModalContent,
	MemberRow,
	SettingsIndex,
} from "@colibri-social/ui";
import { createMemo, Match, Switch } from "solid-js";
import { useAccountActions } from "../../../auth/account-actions";
import { displayNameOf } from "../../../data/adapters/authors";
import { uiPresence } from "../../../data/adapters/presence";
import { useData } from "../../../data/store";
import type { ModalAreaProps } from "../../../shell/desktop/modal-areas";
import type { Layer, SettingsLayer } from "../../../shell/layers";
import { useStack } from "../../../shell/stack";
import EditProfileScreen from "../../edit-profile/edit-profile.screen";
import { type PageHost, PageHostContext } from "../../edit-profile/page-host";
import {
	type SettingsNav,
	SettingsNavContext,
	type SettingsPageId,
	settingsPage,
} from "../nav";
import { SETTINGS_PAGES, settingsEntries } from "../registry";
import SettingsScreen from "../settings.screen";

export { ATMOSPHERE_ACCOUNT_URL } from "../nav";

export const settingsPageOf = (layer: Layer | undefined): SettingsPageId =>
	settingsPage(layer?.kind === "settings" ? layer.page : undefined);

export default function SettingsModal(props: ModalAreaProps) {
	const stack = useStack();
	const data = useData();
	const account = useAccountActions();
	const pages = createMemo(() =>
		props.layers.filter(
			(layer): layer is SettingsLayer => layer.kind === "settings",
		),
	);
	const top = () => settingsPageOf(pages().at(-1));
	const root = () => settingsPageOf(pages()[0]);

	const guarded = (action: () => void) =>
		stack.confirmLeave(props.depth, action);

	const host: PageHost = {
		depth: () => props.depth + pages().length,
	};

	const select = (page: SettingsPageId) =>
		guarded(() => {
			if (pages().length === 1 && top() === page) return;
			if (pages().length > 1) stack.popTo(props.depth + 1);
			stack.replaceTop({ kind: "settings", page });
		});

	const nav: SettingsNav = {
		open: (page) => stack.push({ kind: "settings", page }),
		back: () => guarded(() => stack.pop()),
	};

	const trail = () =>
		pages()
			.slice(0, -1)
			.map((layer, index) => ({
				label: SETTINGS_PAGES[settingsPageOf(layer)].title,
				onSelect: () => guarded(() => stack.popTo(props.depth + index + 1)),
			}));

	const presence = () =>
		data.presenceOf(data.viewer.did) ?? data.viewer.presence;

	const sidebarNav: SettingsNav = {
		open: select,
		back: nav.back,
	};

	return (
		<SettingsNavContext.Provider value={nav}>
			<LargeModalContent
				title={SETTINGS_PAGES[top()].title}
				trail={trail()}
				onBack={pages().length > 1 ? nav.back : undefined}
				sidebar={
					<SettingsIndex
						variant="desktop"
						entries={settingsEntries(data, sidebarNav)}
						active={SETTINGS_PAGES[root()].entry}
						onLogOut={account ? () => void account.signOut() : undefined}
						header={
							<MemberRow
								variant="desktop"
								name={displayNameOf(data.viewer)}
								seed={data.viewer.did}
								avatarSrc={data.viewer.avatar}
								presence={uiPresence(presence())}
								status={presence()?.status?.text || data.viewer.handle}
								statusShowWhileOffline
							/>
						}
					/>
				}
			>
				<Switch>
					<Match when={top() === "editProfile"}>
						<PageHostContext.Provider value={host}>
							<EditProfileScreen args={{}} />
						</PageHostContext.Provider>
					</Match>
					<Match when={top() !== "editProfile"}>
						<SettingsScreen args={{ page: top() }} />
					</Match>
				</Switch>
			</LargeModalContent>
		</SettingsNavContext.Provider>
	);
}

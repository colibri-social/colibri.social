import {
	ListGroup,
	NavHeader,
	SettingsIndex,
	ToggleRow,
} from "@colibri-social/ui";
import { Show, useContext } from "solid-js";
import { useAccountActions } from "../../auth/account-actions";
import { useData } from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import type { Platform } from "../../screen/platform";
import { useStack } from "../../shell/stack";
import {
	type SettingsNav,
	SettingsNavContext,
	type SettingsPageId,
} from "./nav";
import { SETTINGS_PAGES, SettingsPageView, settingsEntries } from "./registry";

export type SettingsArgs = { page?: SettingsPageId };

const useMobileNav = (): SettingsNav => {
	const stack = useStack();
	return {
		open: (page) =>
			stack.push(
				page === "editProfile"
					? { kind: "editProfile" }
					: { kind: "settings", page },
			),
		back: () => void stack.pop(),
	};
};

export const settings = defineContract({
	id: "settings",
	model: (args: SettingsArgs) => {
		const data = useData();
		const nav = useContext(SettingsNavContext) ?? useMobileNav();
		const account = useAccountActions();
		return {
			args,
			data,
			nav,
			entries: () => settingsEntries(data, nav),
			logOut: account ? () => void account.signOut() : undefined,
			simulated: import.meta.env.DEV,
		};
	},
	slots: {
		Index: slot((m, p: { platform: Platform }) => (
			<SettingsNavContext.Provider value={m.nav}>
				<SettingsIndex
					variant={p.platform}
					entries={m.entries()}
					onLogOut={m.logOut}
				/>
			</SettingsNavContext.Provider>
		)),
		Header: slot((m) => (
			<NavHeader
				title={SETTINGS_PAGES[m.args.page ?? "profile"].title}
				kind="back"
				onNavigate={m.nav.back}
				safeTop
			/>
		)),
		Page: slot((m, p: { platform: Platform }) => (
			<SettingsNavContext.Provider value={m.nav}>
				<SettingsPageView
					page={m.args.page ?? "profile"}
					platform={p.platform}
				/>
			</SettingsNavContext.Provider>
		)),
		Simulation: slot((m) => (
			<Show when={m.simulated}>
				<ListGroup label="Mock data">
					<ToggleRow
						title="Slow network"
						description="Makes loading, sending and uploads five times slower."
						checked={m.data.simulation().slowNetwork}
						onChange={(checked) =>
							m.data.setSimulation({ slowNetwork: checked })
						}
					/>
				</ListGroup>
			</Show>
		)),
	},
});

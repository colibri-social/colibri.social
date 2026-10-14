import {
	AtmosphereGlyph,
	LargeModalContent,
	MemberRow,
	SidebarNavItem,
	SidebarNavSection,
} from "@colibri-social/ui";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { Tuning2Icon } from "@solar-icons/solid/bold/tuning-2";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { createMemo, For, type JSX, Match, Switch } from "solid-js";
import { displayNameOf } from "../../../data/adapters/authors";
import { uiPresence } from "../../../data/adapters/presence";
import { useData } from "../../../data/store";
import type { ModalAreaProps } from "../../../shell/desktop/modal-areas";
import type { Layer, SettingsLayer } from "../../../shell/layers";
import { useStack } from "../../../shell/stack";
import EditProfileScreen from "../../edit-profile/edit-profile.screen";
import {
	type PageGuard,
	type PageHost,
	PageHostContext,
} from "../../edit-profile/page-host";
import SettingsScreen from "../settings.screen";

export const SETTINGS_PAGES = ["profile", "appearance", "advanced"] as const;

export type SettingsPage = (typeof SETTINGS_PAGES)[number];

type PageInfo = { label: string; icon: () => JSX.Element };

const PAGE_INFO: Record<SettingsPage, PageInfo> = {
	profile: { label: "Profile", icon: () => <UserIdIcon /> },
	appearance: { label: "Appearance", icon: () => <PaletteIcon /> },
	advanced: { label: "Advanced", icon: () => <Tuning2Icon /> },
};

export const ATMOSPHERE_ACCOUNT_URL = "https://atmosphereaccount.com/";

type ExternalLink = { label: string; href: string; icon: () => JSX.Element };

const SECTIONS: {
	label: string;
	pages: SettingsPage[];
	links?: ExternalLink[];
}[] = [
	{
		label: "Account",
		pages: ["profile"],
		links: [
			{
				label: "My Atmosphere Account",
				href: ATMOSPHERE_ACCOUNT_URL,
				icon: () => <AtmosphereGlyph />,
			},
		],
	},
	{ label: "App settings", pages: ["appearance", "advanced"] },
];

export const settingsPageOf = (layer: Layer | undefined): SettingsPage => {
	const page = layer?.kind === "settings" ? layer.page : undefined;
	return SETTINGS_PAGES.includes(page as SettingsPage)
		? (page as SettingsPage)
		: "profile";
};

export default function SettingsModal(props: ModalAreaProps) {
	const stack = useStack();
	const data = useData();
	const pages = createMemo(() =>
		props.layers.filter(
			(layer): layer is SettingsLayer => layer.kind === "settings",
		),
	);
	const top = () => settingsPageOf(pages().at(-1));

	let guard: PageGuard | undefined;
	let pending: (() => void) | undefined;

	const guarded = (action: () => void) => {
		if (guard?.blocked()) {
			pending = action;
			guard.onBlocked();
			return;
		}
		action();
	};

	const host: PageHost = {
		depth: () => props.depth + pages().length,
		register: (next) => {
			guard = next;
			return () => {
				if (guard === next) guard = undefined;
			};
		},
		proceed: (reason) => {
			const action = pending;
			pending = undefined;
			if (action) {
				action();
				return;
			}
			if (reason === "discard") stack.popTo(props.depth);
		},
	};

	const select = (page: SettingsPage) =>
		guarded(() => {
			if (pages().length === 1 && top() === page) return;
			if (pages().length > 1) stack.popTo(props.depth + 1);
			stack.replaceTop({ kind: "settings", page });
		});

	const trail = () =>
		pages()
			.slice(0, -1)
			.map((layer, index) => ({
				label: PAGE_INFO[settingsPageOf(layer)].label,
				onSelect: () => guarded(() => stack.popTo(props.depth + index + 1)),
			}));

	const presence = () =>
		data.presenceOf(data.viewer.did) ?? data.viewer.presence;

	return (
		<LargeModalContent
			title={PAGE_INFO[top()].label}
			trail={trail()}
			onBack={pages().length > 1 ? () => guarded(() => stack.pop()) : undefined}
			sidebar={
				<>
					<MemberRow
						variant="desktop"
						name={displayNameOf(data.viewer)}
						seed={data.viewer.did}
						avatarSrc={data.viewer.avatar}
						presence={uiPresence(presence())}
						status={presence()?.status?.text || data.viewer.handle}
						statusShowWhileOffline
						aria-label="Your profile"
						onOpen={() => select("profile")}
					/>
					<For each={SECTIONS}>
						{(section) => (
							<SidebarNavSection label={section.label}>
								<For each={section.pages}>
									{(page) => (
										<SidebarNavItem
											icon={PAGE_INFO[page].icon()}
											label={PAGE_INFO[page].label}
											active={top() === page}
											onClick={() => select(page)}
										/>
									)}
								</For>
								<For each={section.links ?? []}>
									{(link) => (
										<SidebarNavItem
											icon={link.icon()}
											label={link.label}
											href={link.href}
											external
										/>
									)}
								</For>
							</SidebarNavSection>
						)}
					</For>
				</>
			}
		>
			<Switch>
				<Match when={top() === "profile"}>
					<PageHostContext.Provider value={host}>
						<EditProfileScreen args={{}} />
					</PageHostContext.Provider>
				</Match>
				<Match when={top() === "appearance"}>
					<SettingsScreen args={{ page: "appearance" }} />
				</Match>
				<Match when={top() === "advanced"}>
					<SettingsScreen args={{ page: "advanced" }} />
				</Match>
			</Switch>
		</LargeModalContent>
	);
}

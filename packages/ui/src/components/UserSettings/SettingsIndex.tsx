import { BellIcon } from "@solar-icons/solid/bold/bell";
import { BugIcon } from "@solar-icons/solid/bold/bug";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { DocumentTextIcon } from "@solar-icons/solid/bold/document-text";
import { HandMoneyIcon } from "@solar-icons/solid/bold/hand-money";
import { LikeIcon } from "@solar-icons/solid/bold/like";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { Microphone2Icon } from "@solar-icons/solid/bold/microphone-2";
import { NotesIcon } from "@solar-icons/solid/bold/notes";
import { Palette2Icon } from "@solar-icons/solid/bold/palette-2";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { StarsIcon } from "@solar-icons/solid/bold/stars";
import { TestTubeMinimalisticIcon } from "@solar-icons/solid/bold/test-tube-minimalistic";
import { Tuning2Icon } from "@solar-icons/solid/bold/tuning-2";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { createSignal, For, type JSX, Show } from "solid-js";
import { AtmosphereGlyph, PdslsLogo } from "../../icons/animated/brand";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import {
	DestructiveRow,
	ListGroup,
	NavRow,
	SidebarNav,
	SidebarNavItem,
	SidebarNavSection,
} from "../List/List";
import { SettingsSearch, SettingsSearchEmpty } from "../List/settings-search";
import { SearchField } from "../TextField/TextField";

export type SettingsEntryId =
	| "profile"
	| "emojiPacks"
	| "atmosphereAccount"
	| "voiceVideo"
	| "appearance"
	| "chat"
	| "notifications"
	| "advanced"
	| "whatsNew"
	| "feedback"
	| "documentation"
	| "support"
	| "experiments"
	| "copyDid"
	| "pdsls"
	| "debugInfo"
	| "logs";

export type SettingsEntryAction = {
	onSelect?: () => void;
	href?: string;
	external?: boolean;
};

export type SettingsEntries = Partial<
	Record<SettingsEntryId, SettingsEntryAction>
>;

type EntryInfo = {
	label: string;
	icon: () => JSX.Element;
	keywords?: readonly string[];
};

export const SETTINGS_ENTRY_INFO: Record<SettingsEntryId, EntryInfo> = {
	profile: {
		label: "Profile",
		icon: () => <UserIdIcon />,
		keywords: ["name", "picture", "avatar", "banner", "bio", "status"],
	},
	emojiPacks: {
		label: "My emoji packs",
		icon: () => <SmileCircleIcon />,
		keywords: ["emoji", "stickers"],
	},
	atmosphereAccount: {
		label: "My Atmosphere Account",
		icon: () => <AtmosphereGlyph />,
		keywords: ["password", "email", "handle"],
	},
	voiceVideo: {
		label: "Voice & video",
		icon: () => <Microphone2Icon />,
		keywords: ["microphone", "camera", "speaker", "audio", "call"],
	},
	appearance: {
		label: "Appearance",
		icon: () => <Palette2Icon />,
		keywords: ["theme", "dark", "light", "previews"],
	},
	chat: {
		label: "Chat",
		icon: () => <ChatRoundDotsIcon />,
		keywords: [
			"links",
			"previews",
			"Bluesky",
			"gestures",
			"swipe",
			"double tap",
			"reaction",
		],
	},
	notifications: {
		label: "Notifications",
		icon: () => <BellIcon />,
		keywords: ["mentions", "replies", "alerts"],
	},
	advanced: {
		label: "Advanced",
		icon: () => <Tuning2Icon />,
		keywords: ["developer"],
	},
	whatsNew: {
		label: "What's new",
		icon: () => <StarsIcon />,
		keywords: ["updates", "changes", "release"],
	},
	feedback: {
		label: "Feedback",
		icon: () => <LikeIcon />,
		keywords: ["bug", "idea", "report"],
	},
	documentation: {
		label: "Documentation",
		icon: () => <NotesIcon />,
		keywords: ["help", "guide"],
	},
	support: {
		label: "Support Colibri",
		icon: () => <HandMoneyIcon />,
		keywords: ["donate"],
	},
	experiments: {
		label: "Experiments",
		icon: () => <TestTubeMinimalisticIcon />,
		keywords: ["beta", "preview"],
	},
	copyDid: { label: "Copy DID", icon: () => <CopyIcon /> },
	pdsls: { label: "View account on PDSls", icon: () => <PdslsLogo /> },
	debugInfo: { label: "Debug information", icon: () => <BugIcon /> },
	logs: { label: "Logs", icon: () => <DocumentTextIcon /> },
};

type EntrySection = { label: string; entries: SettingsEntryId[] };

const SECTIONS: EntrySection[] = [
	{
		label: "Account",
		entries: ["profile", "emojiPacks", "atmosphereAccount"],
	},
	{
		label: "App settings",
		entries: ["voiceVideo", "appearance", "chat", "notifications", "advanced"],
	},
	{
		label: "Other",
		entries: [
			"whatsNew",
			"feedback",
			"documentation",
			"support",
			"experiments",
		],
	},
];

const DEVELOPER_SECTION: EntrySection = {
	label: "Developer mode",
	entries: ["copyDid", "pdsls", "debugInfo", "logs"],
};

const LOG_OUT_LABEL = "Log out";

export type SettingsIndexVariant = "mobile" | "desktop";

export type SettingsIndexProps = {
	variant?: SettingsIndexVariant;
	entries: SettingsEntries;
	active?: SettingsEntryId;
	onLogOut?: () => void;
	header?: JSX.Element;
	query?: string;
	defaultQuery?: string;
	onQueryChange?: (query: string) => void;
	class?: string;
};

export const SettingsIndex = (props: SettingsIndexProps) => {
	const header = createSlot(() => props.header);
	const [internalQuery, setInternalQuery] = createSignal(
		props.defaultQuery ?? "",
	);
	const query = () => props.query ?? internalQuery();
	const setQuery = (next: string) => {
		setInternalQuery(next);
		props.onQueryChange?.(next);
	};
	const desktop = () => props.variant === "desktop";

	const present = (section: EntrySection) =>
		section.entries.filter((id) => props.entries[id]);

	const visible = (list: EntrySection[]) =>
		list
			.map((section) => ({ label: section.label, entries: present(section) }))
			.filter((section) => section.entries.length > 0);
	const mainSections = () => visible(SECTIONS);
	const developerSections = () => visible([DEVELOPER_SECTION]);

	const select = (id: SettingsEntryId) => () => props.entries[id]?.onSelect?.();

	return (
		<SettingsSearch query={query()}>
			<div
				data-settings-index={desktop() ? "desktop" : "mobile"}
				class={cx(
					"flex w-full min-w-0 flex-col",
					desktop() ? "gap-4" : "gap-6",
					props.class,
				)}
			>
				<Show when={header.has()}>{header()}</Show>
				<SearchField
					value={query()}
					onChange={setQuery}
					placeholder="Search settings"
					aria-label="Search settings"
					clearLabel="Clear search"
				/>
				<Show
					when={desktop()}
					fallback={
						<>
							<For each={mainSections()}>
								{(section) => (
									<MobileSection
										section={section}
										entries={props.entries}
										select={select}
									/>
								)}
							</For>
							<Show when={props.onLogOut}>
								{(onLogOut) => (
									<ListGroup>
										<DestructiveRow
											icon={<Logout2Icon />}
											label={LOG_OUT_LABEL}
											keywords={["sign out"]}
											onClick={() => onLogOut()()}
										/>
									</ListGroup>
								)}
							</Show>
							<For each={developerSections()}>
								{(section) => (
									<MobileSection
										section={section}
										entries={props.entries}
										select={select}
									/>
								)}
							</For>
						</>
					}
				>
					<SidebarNav aria-label="Settings">
						<For each={mainSections()}>
							{(section) => (
								<DesktopSection
									section={section}
									entries={props.entries}
									active={props.active}
									select={select}
								/>
							)}
						</For>
						<Show when={props.onLogOut}>
							{(onLogOut) => (
								<SidebarNavSection>
									<SidebarNavItem
										icon={<Logout2Icon />}
										label={LOG_OUT_LABEL}
										keywords={["sign out"]}
										tone="destructive"
										onClick={() => onLogOut()()}
									/>
								</SidebarNavSection>
							)}
						</Show>
						<For each={developerSections()}>
							{(section) => (
								<DesktopSection
									section={section}
									entries={props.entries}
									active={props.active}
									select={select}
								/>
							)}
						</For>
					</SidebarNav>
				</Show>
				<SettingsSearchEmpty />
			</div>
		</SettingsSearch>
	);
};

const MobileSection = (props: {
	section: { label: string; entries: SettingsEntryId[] };
	entries: SettingsEntries;
	select: (id: SettingsEntryId) => () => void;
}) => (
	<ListGroup label={props.section.label}>
		<For each={props.section.entries}>
			{(id) => (
				<NavRow
					icon={SETTINGS_ENTRY_INFO[id].icon()}
					label={SETTINGS_ENTRY_INFO[id].label}
					keywords={SETTINGS_ENTRY_INFO[id].keywords}
					href={props.entries[id]?.href}
					external={props.entries[id]?.external}
					onClick={props.select(id)}
				/>
			)}
		</For>
	</ListGroup>
);

const DesktopSection = (props: {
	section: { label: string; entries: SettingsEntryId[] };
	entries: SettingsEntries;
	active?: SettingsEntryId;
	select: (id: SettingsEntryId) => () => void;
}) => (
	<SidebarNavSection label={props.section.label}>
		<For each={props.section.entries}>
			{(id) => (
				<SidebarNavItem
					icon={SETTINGS_ENTRY_INFO[id].icon()}
					label={SETTINGS_ENTRY_INFO[id].label}
					keywords={SETTINGS_ENTRY_INFO[id].keywords}
					href={props.entries[id]?.href}
					external={props.entries[id]?.external}
					active={props.active === id}
					onClick={props.select(id)}
				/>
			)}
		</For>
	</SidebarNavSection>
);

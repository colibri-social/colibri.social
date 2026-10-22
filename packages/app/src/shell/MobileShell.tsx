import {
	AnimatedInboxIcon,
	AnimatedProfileIcon,
	AnimatedSettingsIcon,
	AnimatedUsersGroupTwoRoundedIcon,
	DiscardChangesDialog,
	TabBar,
	TabBarItem,
} from "@colibri-social/ui";
import {
	type JSX,
	lazy,
	Match,
	onCleanup,
	onMount,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { useData } from "../data/store";
import { messageSelectionActive } from "../screens/channel/selection/selection";
import { MemberMenuProvider } from "../screens/members/member-menu";
import { ProfileSheetProvider } from "../screens/profile/profile-sheet";
import { settingsPage } from "../screens/settings/nav";
import SpacesScreen from "../screens/spaces/spaces.screen";
import VoiceScreen from "../screens/voice/voice.screen";
import { AppLinkHost } from "./AppLinkHost";
import { CallPillHost } from "./CallPillHost";
import { restoreLastViewed } from "./cold-start";
import { installFlingGuard } from "./fling-guard";
import { installKeyboardInset } from "./keyboard-inset";
import { LayerStack } from "./LayerStack";
import type { Layer, Tab } from "./layers";
import { LoadErrorState, NotFoundScreen } from "./load-error";
import { NotificationHost } from "./NotificationHost";
import { installOverlayBack } from "./overlay-back";
import { AdminScreen, AppScreen } from "./registry";
import { createStack } from "./stack";
import { installTapGuard } from "./tap-guard";
import { WriteFailureToasts } from "./WriteFailureToasts";

const SettingsScreen = lazy(
	() => import("../screens/settings/settings.screen"),
);
const InboxScreen = lazy(() => import("../screens/inbox/inbox.screen"));
const ProfileScreen = lazy(() => import("../screens/profile/profile.screen"));
const EditProfileScreen = lazy(
	() => import("../screens/edit-profile/edit-profile.screen"),
);
const loadChannel = () => import("../screens/channel/channel.screen");
const loadMembers = () => import("../screens/members/members.screen");
const loadThread = () => import("../screens/thread/thread.screen");

const ChannelScreen = lazy(loadChannel);
const MembersScreen = lazy(loadMembers);
const ThreadScreen = lazy(loadThread);
const ThreadsScreen = lazy(() => import("../screens/threads/threads.screen"));
const ThreadDraftScreen = lazy(
	() => import("../screens/thread-draft/thread-draft.screen"),
);

const prefetchLayers = () => {
	const idle =
		window.requestIdleCallback ??
		((callback: () => void) => setTimeout(callback, 300));
	idle(() => {
		void loadChannel()
			.then((module) => module.default.variants.mobile?.())
			.then(() => loadMembers())
			.then((module) => module.default.variants.mobile?.())
			.then(() => loadThread());
	});
};

export const MobileShell = () => {
	const data = useData();
	const inboxUnread = () => data.notifications.unreadCount();
	onMount(prefetchLayers);
	onCleanup(installOverlayBack());
	onCleanup(installTapGuard());
	onCleanup(installFlingGuard());
	let shell: HTMLDivElement | undefined;
	onCleanup(installKeyboardInset({ shell: () => shell }));
	const stack = createStack({
		canForward: (top) =>
			!messageSelectionActive() &&
			(top?.kind !== "chat" || data.controls().swipeLeftAction !== "reply"),
		forward: (top) => {
			if (top?.kind === "chat") {
				return { kind: "members", space: top.space, channel: top.channel };
			}
			return undefined;
		},
	});

	const selectTab = (tab: string) => {
		const current = stack.root();
		stack.setRoot({ ...current, tab: tab as Tab });
	};

	restoreLastViewed(data, stack);

	const communitiesFailed = () =>
		data.communities.value() ? undefined : data.communities.error();

	const base = (): JSX.Element => (
		<>
			<Switch>
				<Match when={stack.root().tab === "spaces"}>
					<Show
						when={communitiesFailed()}
						keyed
						fallback={<SpacesScreen args={{ slug: stack.root().space }} />}
					>
						{(error) => (
							<div class="flex min-h-0 flex-1 flex-col bg-background pt-safe">
								<LoadErrorState
									title="Your Spaces didn't load"
									error={error}
									onRetry={data.communities.retry}
								/>
							</div>
						)}
					</Show>
				</Match>
				<Match when={stack.root().tab === "inbox"}>
					<Suspense>
						<InboxScreen args={{}} />
					</Suspense>
				</Match>
				<Match when={stack.root().tab === "profile"}>
					<Suspense>
						<ProfileScreen args={{}} />
					</Suspense>
				</Match>
				<Match when={stack.root().tab === "settings"}>
					<Suspense>
						<SettingsScreen args={{}} />
					</Suspense>
				</Match>
			</Switch>
			<VoiceScreen args={{}} />
			<TabBar value={stack.root().tab} onChange={selectTab}>
				<TabBarItem
					value="spaces"
					label="Spaces"
					icon={<AnimatedUsersGroupTwoRoundedIcon trigger="press" />}
				/>
				<TabBarItem
					value="inbox"
					label="Inbox"
					icon={<AnimatedInboxIcon trigger="press" />}
					badge={inboxUnread() > 0 ? "dot" : undefined}
					badgeLabel={inboxUnread() > 0 ? `${inboxUnread()} unread` : undefined}
				/>
				<TabBarItem
					value="profile"
					label="Profile"
					icon={<AnimatedProfileIcon trigger="press" />}
				/>
				<TabBarItem
					value="settings"
					label="Settings"
					icon={<AnimatedSettingsIcon trigger="press" />}
				/>
			</TabBar>
		</>
	);

	const renderLayer = (layer: Layer): JSX.Element => (
		<Suspense>
			<Switch>
				<Match when={layer.kind === "chat" && layer}>
					{(chat) => (
						<ChannelScreen
							args={{
								space: chat().space,
								channel: chat().channel,
								channelType: chat().channelType,
							}}
						/>
					)}
				</Match>
				<Match when={layer.kind === "members" && layer}>
					{(members) => (
						<MembersScreen
							args={{ space: members().space, channel: members().channel }}
						/>
					)}
				</Match>
				<Match when={layer.kind === "settings" && layer}>
					{(page) => (
						<SettingsScreen args={{ page: settingsPage(page().page) }} />
					)}
				</Match>
				<Match when={layer.kind === "editProfile"}>
					<EditProfileScreen args={{}} />
				</Match>
				<Match when={layer.kind === "threadDraft" && layer}>
					{(draft) => (
						<ThreadDraftScreen
							args={{
								space: draft().space,
								channel: draft().channel,
								channelType: draft().channelType,
								anchor: draft().anchor,
							}}
						/>
					)}
				</Match>
				<Match when={layer.kind === "threads" && layer}>
					{(list) => (
						<ThreadsScreen
							args={{
								space: list().space,
								channel: list().channel,
								channelType: list().channelType,
							}}
						/>
					)}
				</Match>
				<Match when={layer.kind === "thread" && layer}>
					{(thread) => (
						<ThreadScreen
							args={{
								space: thread().space,
								channel: thread().channel,
								thread: thread().thread,
							}}
						/>
					)}
				</Match>
				<Match when={layer.kind === "admin" && layer}>
					{(admin) => (
						<AdminScreen
							page={admin().page}
							args={{ space: admin().space, id: admin().id }}
						/>
					)}
				</Match>
				<Match when={layer.kind === "createSpace"}>
					<AppScreen name="create-space" args={{}} />
				</Match>
				<Match when={layer.kind === "legacySpace" && layer}>
					{(legacy) => (
						<AppScreen name="legacy-space" args={{ did: legacy().did }} />
					)}
				</Match>
				<Match when={layer.kind === "discover"}>
					<AppScreen name="discover" args={{}} />
				</Match>
				<Match when={layer.kind === "join" && layer}>
					{(join) => <AppScreen name="join" args={{ code: join().code }} />}
				</Match>
				<Match when={layer.kind === "pack" && layer}>
					{(pack) => (
						<AppScreen
							name="pack"
							args={{ did: pack().did, rkey: pack().rkey }}
						/>
					)}
				</Match>
				<Match when={layer.kind === "notFound" && layer}>
					{(missing) => (
						<NotFoundScreen path={missing().path} platform="mobile" />
					)}
				</Match>
			</Switch>
		</Suspense>
	);

	return (
		<div
			ref={shell}
			data-mobile-shell=""
			class="h-[calc(100dvh-var(--shell-keyboard-inset,0px))] w-full bg-background font-sans text-foreground"
		>
			<ProfileSheetProvider>
				<MemberMenuProvider>
					<LayerStack stack={stack} base={base()} renderLayer={renderLayer} />
					<CallPillHost />
					<NotificationHost stack={stack} />
					<AppLinkHost stack={stack} />
					<WriteFailureToasts />
					<DiscardChangesDialog guard={stack.leaveGuard} />
				</MemberMenuProvider>
			</ProfileSheetProvider>
		</div>
	);
};

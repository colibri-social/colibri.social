import type { ActorData, OnlineState } from "@colibri-social/lib";
import { createSignal, For, type ParentComponent } from "solid-js";
import { CopyButton } from "../../../src/components/app/common/CopyButton";
import { Lightbox } from "../../../src/components/app/common/Lightbox";
import {
	emptyThemeState,
	ThemeControls,
	type ThemeState,
} from "../../../src/components/app/profile/theme";
import { Avatar } from "../../../src/components/app/user/Avatar";
import { Badge } from "../../../src/components/app/user/Badge";
import { ProfilePopoverContents } from "../../../src/components/app/user/ProfilePopover";
import { DropdownStatusSelect } from "../../../src/components/app/user/StatusSelect";
import { Button } from "../../../src/components/ui/Button";
import { ScrollFadeBottom } from "../../../src/components/ui/ScrollFadeBottom";
import {
	badgeDefinitions,
	ensureBadgeDefinitions,
} from "../../../src/utils/user-badges";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const actor = (name: string, state: OnlineState): ActorData => ({
	did: "did:plc:sandbox",
	handle: "sandbox.example",
	data: {
		displayName: name,
		isBot: false,
		onlineState: state,
	},
});

const AvatarDemo = () => (
	<Demo label="Sizes and states">
		<Avatar user={actor("Small", "online")} size="small" />
		<Avatar user={actor("Base", "away")} size="base" />
		<Avatar user={actor("Large", "dnd")} size="large" />
		<Avatar user={actor("No state", "offline")} disableState />
	</Demo>
);

const BadgeDemo = () => {
	void ensureBadgeDefinitions();
	return (
		<Demo label="Styles">
			<For each={[...badgeDefinitions().keys()]}>
				{(val) => <Badge val={val} size="base" />}
			</For>
			<Badge val="unknown-style" size="sm" />
		</Demo>
	);
};

const CopyButtonDemo = () => (
	<Demo label="CopyButton">
		<span class="text-sm">did:plc:sandbox</span>
		<CopyButton value="did:plc:sandbox" />
	</Demo>
);

const StatusSelectDemo = () => {
	const [status, setStatus] = createSignal<OnlineState>("online");

	return (
		<Demo label="DropdownStatusSelect">
			<DropdownStatusSelect value={status()} setValue={setStatus}>
				<Button variant="outline">Status: {status()}</Button>
			</DropdownStatusSelect>
		</Demo>
	);
};

const ThemeControlsDemo = () => {
	const [theme, setTheme] = createSignal<ThemeState>(emptyThemeState());

	return (
		<Demo label="ThemeControls">
			<div class="w-full max-w-md">
				<ThemeControls
					state={theme()}
					setState={(patch) =>
						setTheme((current) => ({ ...current, ...patch }))
					}
				/>
			</div>
		</Demo>
	);
};

const LightboxDemo = () => (
	<Demo label="Lightbox">
		<Lightbox src="/user-placeholder.png" class="cursor-zoom-in">
			<img
				src="/user-placeholder.png"
				alt="Placeholder preview"
				class="h-16 w-16 rounded-md"
			/>
		</Lightbox>
		<span class="text-muted-foreground text-xs">
			Click the image to open it full screen.
		</span>
	</Demo>
);

const ScrollFadeBottomDemo = () => (
	<Demo label="ScrollFadeBottom">
		<ScrollFadeBottom class="h-32 w-full max-w-sm" wrapperClass="h-32">
			<ul class="flex flex-col gap-1 text-sm">
				<For each={Array.from({ length: 20 }, (_, i) => i + 1)}>
					{(line) => <li>Scrollable line {line}</li>}
				</For>
			</ul>
		</ScrollFadeBottom>
	</Demo>
);

const KIRA: ActorData = {
	did: "did:plc:kirasandbox",
	handle: "kira.colibri.social",
	data: {
		displayName: "Kira",
		isBot: false,
		onlineState: "online",
		description:
			"Building on atproto, mostly in the open. Writing things down at colibri.social, and reachable as @kira.colibri.social if you want to talk shop.",
		status: { emoji: "✨", text: "shipping" },
		theme: {
			accentColor: "#8e51ff",
			gradient: { primary: "#8e51ff", secondary: "#38bdf8" },
		},
	},
};

const KIRA_MINIMAL: ActorData = {
	did: "did:plc:kirasandbox",
	handle: "kira.colibri.social",
	data: {
		displayName: "Kira",
		isBot: false,
		onlineState: "offline",
		theme: { bannerColor: "#2b2b3a" },
	},
};

const PopoverCard: ParentComponent = (props) => (
	<div class="bg-popover text-popover-foreground relative w-80 overflow-hidden rounded-md border p-0 drop-shadow-black drop-shadow-xl">
		{props.children}
	</div>
);

const ProfilePopoverDemo = () => (
	<Demo label="ProfilePopoverContents">
		<PopoverCard>
			<ProfilePopoverContents
				user={KIRA}
				preview={{ avatarUrl: "/user-placeholder.png" }}
			/>
		</PopoverCard>
		<PopoverCard>
			<ProfilePopoverContents
				user={KIRA_MINIMAL}
				preview={{ avatarUrl: "/user-placeholder.png" }}
			/>
		</PopoverCard>
	</Demo>
);

export const APP: SandboxCategory = {
	id: "app",
	title: "App components",
	items: [
		{ id: "avatar", title: "Avatar", component: AvatarDemo },
		{ id: "badge", title: "Badge", component: BadgeDemo },
		{
			id: "profile-popover",
			title: "ProfilePopover",
			component: ProfilePopoverDemo,
		},
		{ id: "copy-button", title: "CopyButton", component: CopyButtonDemo },
		{
			id: "status-select",
			title: "DropdownStatusSelect",
			component: StatusSelectDemo,
		},
		{
			id: "theme-controls",
			title: "ThemeControls",
			component: ThemeControlsDemo,
		},
		{ id: "lightbox", title: "Lightbox", component: LightboxDemo },
		{
			id: "scroll-fade-bottom",
			title: "ScrollFadeBottom",
			component: ScrollFadeBottomDemo,
		},
	],
};

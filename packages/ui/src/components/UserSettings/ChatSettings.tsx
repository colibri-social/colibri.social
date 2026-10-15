import { GlobalIcon } from "@solar-icons/solid/bold/global";
import { createEffect, createSignal, For, type JSX, on, Show } from "solid-js";
import { BlueskyClientLogo } from "../../icons/animated/brand";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import {
	ListGroup,
	NavRow,
	RadioRow,
	RadioRowGroup,
	SectionLabel,
	ToggleRow,
} from "../List/List";
import type { DoubleTapAction } from "../MessageActions/MessageGestures";
import {
	Select,
	type SelectOption,
	type SelectPlatform,
} from "../Select/Select";
import { TextField } from "../TextField/TextField";
import type { BlueskyClientChoice, TouchGestures } from "./types";

export const BLUESKY_CLIENT_NAMES: Record<BlueskyClientChoice, string> = {
	anisota: "Anisota",
	blacksky: "Blacksky",
	bluesky: "Bluesky",
	mu: "Mu Social",
	northsky: "Northsky",
	witchsky: "Witchsky",
	custom: "Another app",
};

const BLUESKY_CLIENTS: BlueskyClientChoice[] = [
	"bluesky",
	"anisota",
	"blacksky",
	"mu",
	"northsky",
	"witchsky",
	"custom",
];

const isBlueskyClient = (value: string): value is BlueskyClientChoice =>
	(BLUESKY_CLIENTS as string[]).includes(value);

const clientOptions = (): SelectOption[] =>
	BLUESKY_CLIENTS.map((id) => ({
		value: id,
		label: BLUESKY_CLIENT_NAMES[id],
		icon: () =>
			id === "custom" ? (
				<GlobalIcon />
			) : (
				<BlueskyClientLogo client={id} class="size-4" />
			),
	}));

const DOUBLE_TAP_ACTIONS: {
	value: DoubleTapAction;
	title: string;
	description: string;
}[] = [
	{
		value: "react",
		title: "React with an emoji",
		description: "Adds the reaction you pick below.",
	},
	{
		value: "editOrReply",
		title: "Edit or reply",
		description: "Edits your own messages and replies to everyone else's.",
	},
];

const isDoubleTapAction = (value: string): value is DoubleTapAction =>
	DOUBLE_TAP_ACTIONS.some((action) => action.value === value);

export const CHAT_SETTINGS_COPY = {
	links: "Links",
	linkPreviews: "Show link previews on messages I send",
	linkPreviewsDescription:
		"Adds a preview when you post a link. You can still turn it off for a single message.",
	warnOnExternalLinks: "Warn me before I leave Colibri",
	warnOnExternalLinksDescription:
		"Shows the full address and asks first when a link leads to another site. Links to Colibri and to your Bluesky app open right away.",
	bluesky: "Bluesky",
	blueskyClient: "Open Bluesky links in",
	blueskyClientDescription:
		"Posts and profiles from Bluesky open in the app you pick here.",
	customDomain: "Address of the app",
	customDomainDescription: "For example bsky.app.",
	customDomainSave: "Save",
	gestures: "Touch gestures",
	swipeToReply: "Swipe left to reply",
	swipeToReplyDescription:
		"Swiping left on a message replies to it. When this is off, it opens the member list.",
	doubleTap: "Double tap a message",
	doubleTapDescription:
		"Reacts or replies without opening the long-press menu.",
	doubleTapAction: "When I double tap",
	reactionEmoji: "Reaction",
} as const;

export type ChatSettingsProps = {
	linkPreviews: boolean;
	onLinkPreviewsChange: (show: boolean) => void;
	warnOnExternalLinks: boolean;
	onWarnOnExternalLinksChange: (warn: boolean) => void;
	blueskyClient: BlueskyClientChoice;
	onBlueskyClientChange: (client: BlueskyClientChoice) => void;
	customClientDomain: string;
	onCustomClientDomainSave: (domain: string) => void;
	customClientDomainError?: JSX.Element;
	gestures?: TouchGestures;
	onGesturesChange?: (change: Partial<TouchGestures>) => void;
	onPickReactionEmoji?: () => void;
	platform?: SelectPlatform;
	class?: string;
};

export const ChatSettings = (props: ChatSettingsProps) => {
	const [domain, setDomain] = createSignal(props.customClientDomain);
	createEffect(
		on(
			() => props.customClientDomain,
			(saved) => setDomain(saved),
			{ defer: true },
		),
	);
	const domainChanged = () =>
		domain().trim().length > 0 &&
		domain().trim() !== props.customClientDomain.trim();

	const saveDomain = () => {
		if (domainChanged()) props.onCustomClientDomainSave(domain().trim());
	};

	return (
		<div
			data-chat-settings=""
			class={cx("flex w-full min-w-0 flex-col gap-6", props.class)}
		>
			<ListGroup label={CHAT_SETTINGS_COPY.links}>
				<ToggleRow
					title={CHAT_SETTINGS_COPY.linkPreviews}
					description={CHAT_SETTINGS_COPY.linkPreviewsDescription}
					keywords={["embeds"]}
					checked={props.linkPreviews}
					onChange={props.onLinkPreviewsChange}
				/>
				<ToggleRow
					title={CHAT_SETTINGS_COPY.warnOnExternalLinks}
					description={CHAT_SETTINGS_COPY.warnOnExternalLinksDescription}
					keywords={["external", "safety"]}
					checked={props.warnOnExternalLinks}
					onChange={props.onWarnOnExternalLinksChange}
				/>
			</ListGroup>
			<section data-bluesky-client-settings="" class="flex flex-col gap-2">
				<SectionLabel label={CHAT_SETTINGS_COPY.bluesky} />
				<Select
					platform={props.platform}
					options={clientOptions()}
					value={props.blueskyClient}
					onChange={(value) => {
						if (isBlueskyClient(value)) props.onBlueskyClientChange(value);
					}}
					label={CHAT_SETTINGS_COPY.blueskyClient}
					description={CHAT_SETTINGS_COPY.blueskyClientDescription}
				/>
				<Show when={props.blueskyClient === "custom"}>
					<form
						class="flex flex-col"
						onSubmit={(event) => {
							event.preventDefault();
							saveDomain();
						}}
					>
						<TextField
							label={CHAT_SETTINGS_COPY.customDomain}
							description={CHAT_SETTINGS_COPY.customDomainDescription}
							error={props.customClientDomainError}
							value={domain()}
							onChange={setDomain}
							placeholder="bsky.app"
							inputMode="url"
							autocomplete="off"
							trailingAction={
								<Button
									type="submit"
									variant="secondary"
									disabled={!domainChanged()}
								>
									{CHAT_SETTINGS_COPY.customDomainSave}
								</Button>
							}
						/>
					</form>
				</Show>
			</section>
			<Show when={props.gestures}>
				{(gestures) => (
					<div data-gesture-settings="" class="flex flex-col gap-6">
						<ListGroup label={CHAT_SETTINGS_COPY.gestures}>
							<ToggleRow
								title={CHAT_SETTINGS_COPY.swipeToReply}
								description={CHAT_SETTINGS_COPY.swipeToReplyDescription}
								keywords={["gestures", "swipe"]}
								checked={gestures().swipeLeftAction === "reply"}
								onChange={(checked) =>
									props.onGesturesChange?.({
										swipeLeftAction: checked ? "reply" : "members",
									})
								}
							/>
							<ToggleRow
								title={CHAT_SETTINGS_COPY.doubleTap}
								description={CHAT_SETTINGS_COPY.doubleTapDescription}
								keywords={["gestures", "double tap"]}
								checked={gestures().doubleTapEnabled}
								onChange={(checked) =>
									props.onGesturesChange?.({ doubleTapEnabled: checked })
								}
							/>
						</ListGroup>
						<Show when={gestures().doubleTapEnabled}>
							<RadioRowGroup
								label={CHAT_SETTINGS_COPY.doubleTapAction}
								value={gestures().doubleTapAction}
								onChange={(value) => {
									if (isDoubleTapAction(value))
										props.onGesturesChange?.({ doubleTapAction: value });
								}}
							>
								<For each={DOUBLE_TAP_ACTIONS}>
									{(action) => (
										<RadioRow
											value={action.value}
											title={action.title}
											description={action.description}
											keywords={["double tap"]}
										/>
									)}
								</For>
							</RadioRowGroup>
							<Show when={gestures().doubleTapAction === "react"}>
								<ListGroup>
									<NavRow
										label={CHAT_SETTINGS_COPY.reactionEmoji}
										keywords={["double tap", "emoji"]}
										value={gestures().doubleTapReactionEmoji}
										disabled={!props.onPickReactionEmoji}
										onClick={() => props.onPickReactionEmoji?.()}
									/>
								</ListGroup>
							</Show>
						</Show>
					</div>
				)}
			</Show>
		</div>
	);
};

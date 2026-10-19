import {
	ChatSettings,
	HIDDEN_MESSAGES_COPY,
	ListGroup,
	ToggleRow,
} from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import {
	isKnownBlueskyClientID,
	normalizeBskyClientBase,
	setBlueskyClient,
} from "../../../data/bluesky-client";
import { canSeeHiddenMessages } from "../../../data/preferences/moderation";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import { createReactionPicker } from "../../channel/composer/media/reaction-picker";

export default function ChatPage(props: { platform: Platform }) {
	const data = useData();
	const client = () => data.preferences.client();
	const [domainError, setDomainError] = createSignal<string>();
	const picker = createReactionPicker();
	const moderatesAnySpace = () =>
		(data.communities.value() ?? []).some(canSeeHiddenMessages);
	const choice = () => {
		const id = client().blueskyClient;
		return isKnownBlueskyClientID(id) ? id : "bluesky";
	};
	return (
		<div class="flex w-full min-w-0 flex-col gap-6">
			<ChatSettings
				linkPreviews={client().linkEmbedsByDefault}
				onLinkPreviewsChange={(show) =>
					void data.preferences.setClient({ linkEmbedsByDefault: show })
				}
				warnOnExternalLinks={client().warnOnExternalLinks}
				onWarnOnExternalLinksChange={(warn) =>
					void data.preferences.setClient({ warnOnExternalLinks: warn })
				}
				blueskyClient={choice()}
				onBlueskyClientChange={(next) => {
					setDomainError(undefined);
					void setBlueskyClient(data.preferences, next);
				}}
				customClientDomain={client().customBlueskyClientBase}
				onCustomClientDomainSave={(domain) => {
					if (!normalizeBskyClientBase(domain)) {
						setDomainError("Enter an address like example.com.");
						return;
					}
					setDomainError(undefined);
					void setBlueskyClient(data.preferences, "custom", domain);
				}}
				customClientDomainError={domainError()}
				gestures={props.platform === "mobile" ? client().controls : undefined}
				onGesturesChange={(change) =>
					void data.preferences.setClient({ controls: change })
				}
				onPickReactionEmoji={() =>
					picker.open(
						(emoji) =>
							void data.preferences.setClient({
								controls: { doubleTapReactionEmoji: emoji },
							}),
					)
				}
				shareActivity={data.preferences.shareActivity()}
				onShareActivityChange={(share) =>
					void data.preferences.setShareActivity(share)
				}
				platform={props.platform}
			/>
			<Show when={moderatesAnySpace()}>
				<ListGroup label={HIDDEN_MESSAGES_COPY.group}>
					<ToggleRow
						title={HIDDEN_MESSAGES_COPY.setting}
						description={HIDDEN_MESSAGES_COPY.settingDescription}
						checked={!client().hideModeratedMessages}
						onChange={(show) =>
							void data.preferences.setClient({
								hideModeratedMessages: !show,
							})
						}
					/>
				</ListGroup>
			</Show>
			<picker.Sheet />
		</div>
	);
}

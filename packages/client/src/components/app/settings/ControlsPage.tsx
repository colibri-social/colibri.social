import twemoji from "@twemoji/api";
import { type Component, createSignal, Show } from "solid-js";
import type { DoubleTapAction } from "../../../contexts/UserPreferences";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { Button } from "../../ui/Button";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemControl,
	RadioGroupItemIndicator,
	RadioGroupItemInput,
	RadioGroupItemLabel,
} from "../../ui/RadioGroup";
import { Separator } from "../../ui/Separator";
import {
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../ui/Switch";
import { EmojiPopover } from "../common/EmojiPopover";
import { SettingsPage } from "../common/SettingsModal";

export const ControlsPage: Component = () => {
	const { preferences, updateControls } = useUserPreferences();
	const [emojiOpen, setEmojiOpen] = createSignal(false);

	return (
		<SettingsPage
			loading={() => false}
			title="Controls"
			description="Customize the touch gestures used while chatting on mobile."
		>
			<Toggle
				class="flex flex-row gap-4 items-center w-full justify-between shrink-0"
				checked={preferences().controls.swipeLeftAction === "reply"}
				onChange={(checked) =>
					updateControls({ swipeLeftAction: checked ? "reply" : "members" })
				}
			>
				<div>
					<SwitchLabel>Swipe left to reply</SwitchLabel>
					<SwitchDescription>
						When on, swiping left on a message replies to it instead of opening
						the member list. Swiping right always opens the channel list.
					</SwitchDescription>
				</div>
				<div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</div>
			</Toggle>

			<Separator class="my-1" />

			<Toggle
				class="flex flex-row gap-4 items-center w-full justify-between shrink-0"
				checked={preferences().controls.doubleTapEnabled}
				onChange={(checked) => updateControls({ doubleTapEnabled: checked })}
			>
				<div>
					<SwitchLabel>Double-tap a message</SwitchLabel>
					<SwitchDescription>
						Double-tap a message to react or reply/edit, without opening the
						long-press menu.
					</SwitchDescription>
				</div>
				<div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</div>
			</Toggle>

			<Show when={preferences().controls.doubleTapEnabled}>
				<RadioGroup
					value={preferences().controls.doubleTapAction}
					onChange={(value) =>
						updateControls({ doubleTapAction: value as DoubleTapAction })
					}
					class="flex flex-col gap-2 pl-1"
				>
					<RadioGroupItem value="react" class="flex items-start gap-2">
						<RadioGroupItemInput />
						<RadioGroupItemControl class="mt-1.5">
							<RadioGroupItemIndicator />
						</RadioGroupItemControl>
						<RadioGroupItemLabel class="flex flex-col">
							<span class="text-base font-bold">React with an emoji</span>
							<span class="text-sm text-muted-foreground">
								Double-tap always reacts with the emoji you pick below.
							</span>
						</RadioGroupItemLabel>
					</RadioGroupItem>
					<RadioGroupItem value="editOrReply" class="flex items-start gap-2">
						<RadioGroupItemInput />
						<RadioGroupItemControl class="mt-1.5">
							<RadioGroupItemIndicator />
						</RadioGroupItemControl>
						<RadioGroupItemLabel class="flex flex-col">
							<span class="text-base font-bold">Edit or reply</span>
							<span class="text-sm text-muted-foreground">
								Double-tap your own messages to edit them, or someone else's to
								reply.
							</span>
						</RadioGroupItemLabel>
					</RadioGroupItem>
				</RadioGroup>

				<Show when={preferences().controls.doubleTapAction === "react"}>
					<div class="flex items-center gap-3 pl-1">
						<EmojiPopover
							emojiPopoverOpen={emojiOpen}
							setEmojiPopoverOpen={setEmojiOpen}
							onEmojiSelect={(emoji) =>
								updateControls({ doubleTapReactionEmoji: emoji })
							}
						>
							<Button variant="secondary" size="icon-sm">
								<span
									class="h-4 w-4"
									innerHTML={twemoji.parse(
										preferences().controls.doubleTapReactionEmoji,
									)}
								/>
							</Button>
						</EmojiPopover>
						<span class="text-sm text-muted-foreground">Reaction emoji</span>
					</div>
				</Show>
			</Show>
		</SettingsPage>
	);
};

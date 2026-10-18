import {
	ListGroup,
	RadioRow,
	RadioRowGroup,
	StatusScreen,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createSignal, For, Show } from "solid-js";
import { emojiPolicy } from "../../../data/emoji";
import type { CustomEmojiPolicy } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminNavHeader } from "../desktop/page-header";
import { useAdminSpace } from "../space-admin";

export const LINK_PREVIEW_COPY = {
	title: "Show link previews",
	description:
		"Whether messages show a preview card for the links they contain. Individual channels can override this, and authors can always hide previews on their own messages.",
} as const;

export const CUSTOM_EMOJI_COPY = {
	label: "Custom emoji",
	options: [
		{
			value: "all",
			title: "All custom emoji",
			description:
				"Members can use custom emoji from this Space, their other Spaces and the emoji they follow.",
		},
		{
			value: "local",
			title: "Only this Space's emoji",
			description: "Custom emoji from anywhere else show as plain text.",
		},
		{
			value: "none",
			title: "No custom emoji",
			description: "Every custom emoji shows as plain text.",
		},
	] satisfies {
		value: CustomEmojiPolicy;
		title: string;
		description: string;
	}[],
} as const;

export const spaceMessages = defineContract({
	id: "adminMessages",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community } = admin;
		const [override, setOverride] = createSignal<boolean>();
		const [saving, setSaving] = createSignal(false);
		const linkEmbeds = () => override() ?? community()?.linkEmbeds ?? true;
		const setLinkEmbeds = async (next: boolean) => {
			const current = community();
			if (!current || saving()) return;
			setOverride(next);
			setSaving(true);
			try {
				await data.community.update({
					community: current.did,
					linkEmbeds: next,
				});
				setOverride(undefined);
			} catch {
				setOverride(undefined);
				toast.error("Couldn't save the message settings");
			} finally {
				setSaving(false);
			}
		};
		const [emojiOverride, setEmojiOverride] = createSignal<CustomEmojiPolicy>();
		const customEmoji = () =>
			emojiOverride() ?? emojiPolicy(community()?.customEmoji);
		const setCustomEmoji = async (next: CustomEmojiPolicy) => {
			const current = community();
			if (!current || saving() || next === customEmoji()) return;
			setEmojiOverride(next);
			setSaving(true);
			try {
				await data.community.update({
					community: current.did,
					customEmoji: next,
				});
			} catch {
				toast.error("Couldn't save the message settings");
			} finally {
				setEmojiOverride(undefined);
				setSaving(false);
			}
		};
		return {
			...admin,
			back: () => stack.pop(),
			linkEmbeds,
			setLinkEmbeds,
			customEmoji,
			setCustomEmoji,
			saving,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title="Messages"
			/>
		)),
		Missing: slot((m) => (
			<Show when={m.missing()}>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Settings: slot((m) => (
			<div class="flex flex-col gap-2">
				<p class="m-0 px-1 text-sm text-muted-foreground">
					How messages behave across every channel in this Space.
				</p>
				<ListGroup>
					<ToggleRow
						title={LINK_PREVIEW_COPY.title}
						description={LINK_PREVIEW_COPY.description}
						checked={m.linkEmbeds()}
						onChange={(next) => void m.setLinkEmbeds(next)}
						disabled={m.saving()}
					/>
				</ListGroup>
				<RadioRowGroup
					class="mt-4"
					label={CUSTOM_EMOJI_COPY.label}
					value={m.customEmoji()}
					onChange={(next) => void m.setCustomEmoji(next as CustomEmojiPolicy)}
					disabled={m.saving()}
				>
					<For each={CUSTOM_EMOJI_COPY.options}>
						{(option) => (
							<RadioRow
								value={option.value}
								title={option.title}
								description={option.description}
							/>
						)}
					</For>
				</RadioRowGroup>
			</div>
		)),
	},
});

import twemoji from "@twemoji/api";
import { type Component, createSignal, Match, Switch } from "solid-js";
import { toast } from "somoto";
import { EmojiPopover } from "../common/EmojiPopover";
import { SettingsPage } from "../common/SettingsModal";
import { useUserContext } from "../../../contexts/User";
import { TextField, TextFieldInput } from "../../ui/TextField";
import { Button } from "../../ui/Button";
import SmileyIcon from "~icons/ph/smiley";

export const StatusPage: Component = () => {
	const user = useUserContext();

	const [loading, setLoading] = createSignal(false);
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	const [status, setStatus] = createSignal(user.data.status?.text || "");
	const [emoji, setEmoji] = createSignal(user.data.status?.emoji || "");

	const saveStatus = async () => {
		setLoading(true);

		// TODO: Write to PDS
		// const statusRes = await actions.setStatus({
		// 	status: status(),
		// 	emoji: emoji(),
		// });

		// setLoading(false);

		// if (statusRes.error) {
		// 	toast.error("Failed to update status", {
		// 		description: parseZodToErrorOrDisplay(statusRes.error.message),
		// 	});
		// 	return;
		// }

		// setUserData({
		// 	...globalData.user,
		// 	status: status(),
		// 	emoji: emoji(),
		// });

		resetStatus();
	};

	const resetStatus = async () => {
		setStatus(user.data.status?.text || "");
		setEmoji(user.data.status?.emoji || "");
		setLoading(false);
	};

	const hasEdited = () =>
		status() !== (user.data.status?.text || "") ||
		emoji() !== (user.data.status?.emoji || "");

	return (
		<SettingsPage
			loading={loading}
			title="Status"
			onSave={saveStatus}
			onReset={resetStatus}
			canReset={hasEdited()}
		>
			<TextField
				value={status()}
				onChange={setStatus}
				validationState={
					status() !== undefined && status()!.trim().length < 33
						? "valid"
						: "invalid"
				}
				class="gap-0 relative"
			>
				<EmojiPopover
					emojiPopoverOpen={popoverOpen}
					setEmojiPopoverOpen={setPopoverOpen}
					onEmojiClick={(e) => setEmoji(e.emoji)}
				>
					<Button
						variant="secondary"
						class="absolute top-0.5 left-0.5 rounded-sm w-8 h-8 p-2"
						size="sm"
					>
						<Switch>
							<Match when={emoji()}>
								<div innerHTML={twemoji.parse(emoji())} />
							</Match>
							<Match when={!emoji()}>
								<SmileyIcon />
							</Match>
						</Switch>
					</Button>
				</EmojiPopover>
				<TextFieldInput
					maxLength={32}
					required
					type="text"
					class="resize-none pl-10"
				/>
			</TextField>
			<Button
				variant="secondary"
				classList={{
					"hidden!":
						hasEdited() || (emoji()?.length === 0 && status()?.length === 0),
				}}
				onClick={() => {
					setEmoji("");
					setStatus("");
					saveStatus();
				}}
			>
				Reset Status
			</Button>
		</SettingsPage>
	);
};

import { type Component, For, Show } from "solid-js";
import { useChannelContext } from "../../../../../contexts/Channel";
import { useMessageContext } from "../../../../../contexts/Message";
import { useUserContext } from "../../../../../contexts/User";
import { Button } from "../../../../ui/Button";
import {
	Switch,
	SwitchControl,
	SwitchInput,
	SwitchThumb,
} from "../../../../ui/Switch";

export const EmbedsDialogTitleContent: Component = () => "Link previews";

export const EmbedsDialogDescriptionContent: Component = () =>
	"Choose which link previews show on this message, then save. Previews you hide can only be brought back by you, and previews a moderator hides can only be brought back by a moderator.";

const hostOf = (uri: string): string => {
	try {
		return new URL(uri).host;
	} catch {
		return uri;
	}
};

export const EmbedsDialogBody: Component = () => {
	const user = useUserContext();
	const channel = useChannelContext();
	const {
		message,
		removableEmbedUris,
		authorSuppressedEmbeds,
		modSuppressedEmbeds,
		canModerateEmbeds,
		stagedEmbeds,
		setStagedEmbeds,
	} = useMessageContext();

	const ownsMessage = () => message.author.did === user.did;

	const scopeAllows = () => channel.linkEmbedsEnabled();

	const staged = (): Array<string> => stagedEmbeds() ?? [];

	const hiddenByOther = (uri: string) =>
		ownsMessage()
			? modSuppressedEmbeds().includes(uri)
			: authorSuppressedEmbeds().includes(uri);

	const locked = (uri: string) => !scopeAllows() || hiddenByOther(uri);

	const willShow = (uri: string) =>
		!staged().includes(uri) && !hiddenByOther(uri);

	const toggle = (uri: string, show: boolean) =>
		setStagedEmbeds(
			show ? staged().filter((u) => u !== uri) : [...staged(), uri],
		);

	const anyEditable = () =>
		scopeAllows() && removableEmbedUris().some((uri) => !hiddenByOther(uri));

	const allHidden = () =>
		removableEmbedUris().every((uri) => staged().includes(uri));

	const noneHidden = () => staged().length === 0;

	return (
		<div class="flex flex-col gap-3 px-4 pb-2 min-w-0">
			<Show when={!scopeAllows() && removableEmbedUris().length > 0}>
				<p class="m-0 text-sm text-destructive">
					Link previews are turned off for this channel, so none of these can be
					shown right now.
				</p>
			</Show>
			<Show
				when={removableEmbedUris().length > 0}
				fallback={
					<p class="m-0 text-sm text-muted-foreground">
						This message has no link previews.
					</p>
				}
			>
				<ul class="flex flex-col gap-2 m-0 p-0 list-none max-h-64 overflow-y-auto">
					<For each={removableEmbedUris()}>
						{(uri) => (
							<li class="flex flex-row items-center justify-between gap-3 min-w-0 border border-border rounded-sm p-3">
								<div class="flex flex-col min-w-0">
									<span class="text-sm text-foreground truncate">
										{hostOf(uri)}
									</span>
									<span class="text-xs text-muted-foreground truncate">
										{uri}
									</span>
									<Show when={hiddenByOther(uri)}>
										<span class="text-xs text-destructive">
											{ownsMessage()
												? "Hidden by a moderator."
												: "Hidden by the author."}
										</span>
									</Show>
								</div>
								<Switch
									class="shrink-0"
									checked={willShow(uri)}
									disabled={locked(uri)}
									onChange={(show: boolean) => toggle(uri, show)}
								>
									<SwitchInput />
									<SwitchControl>
										<SwitchThumb />
									</SwitchControl>
								</Switch>
							</li>
						)}
					</For>
				</ul>
				<Show when={anyEditable()}>
					<div class="flex flex-row gap-2">
						<Button
							variant="outline"
							class="cursor-pointer flex-1"
							disabled={allHidden()}
							onClick={() => setStagedEmbeds(removableEmbedUris())}
						>
							Hide all
						</Button>
						<Button
							variant="outline"
							class="cursor-pointer flex-1"
							disabled={noneHidden()}
							onClick={() => setStagedEmbeds([])}
						>
							Show all
						</Button>
					</div>
				</Show>
			</Show>
			<Show when={!ownsMessage() && canModerateEmbeds()}>
				<p class="m-0 text-xs text-muted-foreground">
					You are acting as a moderator. The author can still hide previews you
					restore.
				</p>
			</Show>
		</div>
	);
};

export const EmbedsDialogCancelButton: Component = () => {
	const { closeEmbedsModal, stagedDirty } = useMessageContext();

	return (
		<Button
			variant="secondary"
			class="cursor-pointer"
			onClick={closeEmbedsModal}
		>
			{stagedDirty() ? "Discard" : "Close"}
		</Button>
	);
};

export const EmbedsDialogSaveButton: Component = () => {
	const { stagedDirty, saveStagedEmbeds } = useMessageContext();

	return (
		<Show when={stagedDirty()}>
			<Button class="cursor-pointer" onClick={() => void saveStagedEmbeds()}>
				Save changes
			</Button>
		</Show>
	);
};

import {
	type Accessor,
	type Component,
	createSignal,
	type Setter,
	Show,
} from "solid-js";
import type { JSX } from "solid-js/jsx-runtime";
import { toast } from "somoto";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import SpeakerHighIcon from "~icons/ph/speaker-high";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { cx } from "../../../utils/cva";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/Dialog";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemControl,
	RadioGroupItemIndicator,
	RadioGroupItemInput,
	RadioGroupItemLabel,
} from "../../ui/RadioGroup";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { ChannelAllowListEditor } from "./ChannelAllowListEditor";

type ValidChannel = "text" | "voice";

export const ChannelCreationModal: Component<{
	category: string;
	community: string;
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const [name, setName] = createSignal("");
	const [type, setType] = createSignal<ValidChannel>("text");
	const [loading, setLoading] = createSignal(false);
	const [isRestricted, setIsRestricted] = createSignal(false);
	// The modal is a two-step flow: step 0 is the channel basics, step 1 is the
	// post allow-list, reachable only when the channel is marked restricted.
	const [page, setPage] = createSignal<0 | 1>(0);
	const [allowedRoles, setAllowedRoles] = createSignal<string[]>([]);
	const [allowedMembers, setAllowedMembers] = createSignal<string[]>([]);

	const categoryName = () =>
		community().categories.find((x) => x.uri === props.category)!.name;

	const reset = () => {
		setName("");
		setType("text");
		setIsRestricted(false);
		setPage(0);
		setAllowedRoles([]);
		setAllowedMembers([]);
	};

	const handleOpenChange = (next: boolean) => {
		props.setOpen(next);
		if (!next) reset();
	};

	const handleCreate = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.channel.create(
				props.community,
				props.category,
				name().trim(),
				`social.colibri.channel.${type()}`,
				isRestricted() ? allowedRoles() : undefined,
				isRestricted() ? allowedMembers() : undefined,
			);
			handleOpenChange(false);
		} catch {
			toast.error("Failed to create channel.");
		} finally {
			setLoading(false);
		}
	};

	const iconsByType: Record<ValidChannel, (className?: string) => JSX.Element> =
		{
			text: (className) => (
				<ChatCircleDotsIcon class={cx("w-5 h-5", className)} />
			),
			voice: (className) => (
				<SpeakerHighIcon class={cx("w-5 h-5", className)} />
			),
		};

	return (
		<ResponsiveDialog
			open={props.open()}
			onOpenChange={handleOpenChange}
			title={page() === 0 ? "Create Channel" : "Restricted Access"}
		>
			<Show
				when={page() === 0}
				fallback={
					<div class="flex flex-col gap-2">
						<span class="text-sm text-muted-foreground">
							Only the roles and members you select here will be able to chat in
							this channel. Leave both empty to allow everyone.
						</span>
						<ChannelAllowListEditor
							allowedRoles={allowedRoles}
							setAllowedRoles={setAllowedRoles}
							allowedMembers={allowedMembers}
							setAllowedMembers={setAllowedMembers}
						/>
					</div>
				}
			>
				<span class="text-sm relative bottom-2 text-muted-foreground">
					in {categoryName()}
				</span>
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<span class="text-sm font-medium">Channel Type</span>
						<RadioGroup
							value={type()}
							onChange={(v) => setType(v as "text" | "voice")}
							class="flex flex-col gap-2"
						>
							<RadioGroupItem value="text" class="flex items-start gap-2">
								<RadioGroupItemInput />
								<RadioGroupItemControl class="mt-1.5">
									<RadioGroupItemIndicator />
								</RadioGroupItemControl>
								<RadioGroupItemLabel class="flex flex-col">
									<div class="flex flex-row items-center gap-1">
										{iconsByType.text()}
										<span class="text-base font-bold">Text</span>
									</div>
									<span class="text-sm text-muted-foreground">
										Send messages, attach files, GIFs, add emojis and converse.
									</span>
								</RadioGroupItemLabel>
							</RadioGroupItem>
							<RadioGroupItem value="voice" class="flex items-start gap-2">
								<RadioGroupItemInput />
								<RadioGroupItemControl class="mt-1.5">
									<RadioGroupItemIndicator />
								</RadioGroupItemControl>
								<RadioGroupItemLabel class="flex flex-col">
									<div class="flex flex-row items-center gap-1">
										{iconsByType.voice()}
										<span class="text-base font-bold">Voice</span>
									</div>
									<span class="text-sm text-muted-foreground">
										Hang out with voice, video, and screen share.
									</span>
								</RadioGroupItemLabel>
							</RadioGroupItem>
						</RadioGroup>
					</div>
					<TextField class="gap-1.5 relative">
						<TextFieldLabel>Name</TextFieldLabel>
						<TextFieldInput
							placeholder="New Channel"
							value={name()}
							onInput={(e) => setName(e.currentTarget.value)}
							class="pl-8"
						/>
						{iconsByType[type()]("absolute top-8.5 left-2")}
					</TextField>
					<Switch
						onChange={setIsRestricted}
						checked={isRestricted()}
						class="flex justify-between items-center gap-x-2 w-full"
					>
						<div>
							<SwitchLabel>Restricted Channel</SwitchLabel>
							<SwitchDescription>
								Only selected members and roles will be able to chat in this
								channel.
							</SwitchDescription>
						</div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</Switch>
				</div>
			</Show>
			<DialogFooter>
				<Show
					when={page() === 0}
					fallback={
						<>
							<Button variant="secondary" onClick={() => setPage(0)}>
								Back
							</Button>
							<Button onClick={handleCreate} disabled={loading()}>
								Create
							</Button>
						</>
					}
				>
					<Button variant="secondary" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Show
						when={isRestricted()}
						fallback={
							<Button
								onClick={handleCreate}
								disabled={loading() || name().trim().length === 0}
							>
								Create
							</Button>
						}
					>
						<Button
							onClick={() => setPage(1)}
							disabled={name().trim().length === 0}
						>
							Next
						</Button>
					</Show>
				</Show>
			</DialogFooter>
		</ResponsiveDialog>
	);
};

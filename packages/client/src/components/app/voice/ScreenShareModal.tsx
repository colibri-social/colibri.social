import type { Component } from "solid-js";
import { Show } from "solid-js";
import {
	framerateLabel,
	resolutionLabel,
	SCREEN_FRAMERATES,
	SCREEN_RESOLUTIONS,
	type ScreenFramerate,
	type ScreenResolution,
	type ScreenShareOptions,
} from "../../../utils/screen-share";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/Dialog";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../ui/Select";
import {
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../ui/Switch";

type ResolutionOption = { id: ScreenResolution; name: string };
type FramerateOption = { id: ScreenFramerate; name: string };

const RESOLUTION_OPTIONS: ResolutionOption[] = SCREEN_RESOLUTIONS.map((id) => ({
	id,
	name: resolutionLabel(id),
}));

const FRAMERATE_OPTIONS: FramerateOption[] = SCREEN_FRAMERATES.map((id) => ({
	id,
	name: framerateLabel(id),
}));

export interface ScreenShareModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: ScreenShareOptions;
	audioSupported: boolean;
	onChange: (patch: Partial<ScreenShareOptions>) => void;
	onConfirm: () => void;
}

export const ScreenShareModal: Component<ScreenShareModalProps> = (props) => {
	return (
		<ResponsiveDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			title="Share your screen"
		>
			<div class="flex flex-col gap-4">
				<p class="text-sm text-muted-foreground m-0">
					Pick the quality first. You'll choose what to share next.
				</p>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<Select
						options={RESOLUTION_OPTIONS}
						optionValue={"id" as never}
						optionTextValue={"name" as never}
						value={RESOLUTION_OPTIONS.find(
							(o) => o.id === props.value.resolution,
						)}
						disallowEmptySelection={true}
						itemComponent={(itemProps) => (
							<SelectItem
								item={itemProps.item}
								onClick={() =>
									props.onChange({
										resolution: (
											itemProps.item.rawValue as unknown as ResolutionOption
										).id,
									})
								}
							>
								{(itemProps.item.rawValue as unknown as ResolutionOption).name}
							</SelectItem>
						)}
					>
						<SelectLabel>Resolution</SelectLabel>
						<SelectTrigger class="w-full" aria-label="Resolution">
							<SelectValue<ResolutionOption>>
								{(state) => state.selectedOption()?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
					</Select>

					<Select
						options={FRAMERATE_OPTIONS}
						optionValue={"id" as never}
						optionTextValue={"name" as never}
						value={FRAMERATE_OPTIONS.find(
							(o) => o.id === props.value.framerate,
						)}
						disallowEmptySelection={true}
						itemComponent={(itemProps) => (
							<SelectItem
								item={itemProps.item}
								onClick={() =>
									props.onChange({
										framerate: (
											itemProps.item.rawValue as unknown as FramerateOption
										).id,
									})
								}
							>
								{(itemProps.item.rawValue as unknown as FramerateOption).name}
							</SelectItem>
						)}
					>
						<SelectLabel>Frame rate</SelectLabel>
						<SelectTrigger class="w-full" aria-label="Frame rate">
							<SelectValue<FramerateOption>>
								{(state) => state.selectedOption()?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
					</Select>
				</div>

				<Show when={props.audioSupported}>
					<Toggle
						class="flex flex-row gap-4 items-center w-full justify-between shrink-0"
						checked={props.value.shareAudio}
						onChange={(checked) => props.onChange({ shareAudio: checked })}
					>
						<div>
							<SwitchLabel>Share sound</SwitchLabel>
							<SwitchDescription>
								Sends audio from the tab or screen you pick. Your microphone is
								unaffected.
							</SwitchDescription>
						</div>
						<div>
							<SwitchInput />
							<SwitchControl>
								<SwitchThumb />
							</SwitchControl>
						</div>
					</Toggle>
				</Show>

				<DialogFooter>
					<Button variant="outline" onClick={() => props.onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={() => props.onConfirm()}>Go Live</Button>
				</DialogFooter>
			</div>
		</ResponsiveDialog>
	);
};

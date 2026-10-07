import { type JSX, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { CallControls, type CallControlsProps } from "./CallControls";
import { VoiceGrid, type VoiceTileData } from "./VoiceGrid";
import { VoiceSheetHeader } from "./VoiceJoin";

export type CallScreenProps = Omit<CallControlsProps, "class" | "size"> & {
	channelName: JSX.Element;
	tiles: VoiceTileData[];
	focusedKey?: string | null;
	onFocusChange?: (key: string | null) => void;
	onClose?: () => void;
	onOpenSettings?: () => void;
	class?: string;
};

export const CallScreen = (props: CallScreenProps) => {
	const [local, controls] = splitProps(props, [
		"channelName",
		"tiles",
		"focusedKey",
		"onFocusChange",
		"onClose",
		"onOpenSettings",
		"class",
	]);
	return (
		<section
			aria-label="Voice call"
			data-call-screen=""
			class={cx(
				"flex h-full min-h-0 flex-col gap-4 bg-popover pt-safe-offset-4 pb-safe-offset-4 px-safe-offset-4 text-foreground",
				local.class,
			)}
		>
			<VoiceSheetHeader
				title={local.channelName}
				onClose={local.onClose}
				closeLabel="Minimize call"
				onOpenSettings={local.onOpenSettings}
			/>
			<div class="min-h-0 flex-1">
				<VoiceGrid
					tiles={local.tiles}
					focusedKey={local.focusedKey}
					onFocusChange={local.onFocusChange}
				/>
			</div>
			<CallControls {...controls} />
		</section>
	);
};

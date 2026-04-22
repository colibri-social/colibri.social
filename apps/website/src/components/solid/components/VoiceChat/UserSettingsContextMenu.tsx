import { createMemo, type ParentComponent } from "solid-js";
import { usePreferencesContext } from "../../contexts/UserPreferencesContext";
import {
	Checkbox,
	CheckboxControl,
	CheckboxInput,
	CheckboxLabel,
} from "../../shadcn-solid/Checkbox";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../shadcn-solid/ContextMenu";
import {
	Slider,
	SliderFill,
	SliderGroup,
	SliderLabel,
	SliderThumb,
	SliderTrack,
	SliderValueLabel,
} from "../../shadcn-solid/Slider";

export const UserSettingsContextMenu: ParentComponent<{
	isLocal: boolean;
	isStream: boolean;
	did: string;
}> = (props) => {
	const [userPreferences, setUserPreferences] = usePreferencesContext();

	const muteUser = (did: string, type: "voice" | "screen", next?: boolean) => {
		const currentState =
			userPreferences.voice.participantVolumeOverrides?.[did]?.[type]?.muted ??
			false;
		const newState = next ?? !currentState;

		setUserPreferences("voice", "participantVolumeOverrides", did, (prev) => {
			// If the user doesn't exist in the overrides yet, initialize them
			if (!prev) {
				return {
					screen: { muted: type === "screen" ? newState : false, volume: 1 },
					voice: { muted: type === "voice" ? newState : false, volume: 1 },
				};
			}

			// If they exist, only update the specific type
			return {
				...prev,
				[type]: {
					...prev[type],
					muted: newState,
				},
			};
		});
	};

	const setUserVolume = (
		did: string,
		type: "voice" | "screen",
		volume: number,
	) => {
		setUserPreferences("voice", "participantVolumeOverrides", did, (prev) => {
			// If the user doesn't exist in the overrides yet, initialize them
			if (!prev) {
				return {
					screen: { muted: false, volume: type === "screen" ? volume : 1 },
					voice: { muted: false, volume: type === "voice" ? volume : 1 },
				};
			}

			// If they exist, only update the specific type
			return {
				...prev,
				[type]: {
					...prev[type],
					volume: volume,
				},
			};
		});
	};

	const volumeForUser = createMemo(() => {
		return (
			userPreferences.voice.participantVolumeOverrides?.[props.did]?.[
				props.isStream ? "screen" : "voice"
			]?.volume ?? 1
		);
	});

	const isMuted = createMemo(() => {
		return (
			userPreferences.voice.participantVolumeOverrides?.[props.did]?.[
				props.isStream ? "screen" : "voice"
			]?.muted ?? false
		);
	});

	return (
		<ContextMenu>
			<ContextMenuTrigger class="w-full" disabled={props.isLocal}>
				{props.children}
			</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent class="w-64">
					<ContextMenuItem>
						<Slider
							defaultValue={[volumeForUser() * 100]}
							step={1}
							maxValue={200}
							getValueLabel={(params) => `${params.values[0]}%`}
							onChange={(e) => {
								const v = e[0] / 100;

								setUserVolume(
									props.did,
									props.isStream ? "screen" : "voice",
									v,
								);
							}}
						>
							<SliderGroup>
								<SliderLabel>Volume</SliderLabel>
								<SliderValueLabel />
							</SliderGroup>
							<SliderTrack>
								<SliderFill />
								<SliderThumb />
							</SliderTrack>
						</Slider>
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						closeOnSelect={false}
						class="cursor-pointer"
						onClick={() =>
							muteUser(props.did, props.isStream ? "screen" : "voice")
						}
					>
						<Checkbox
							checked={isMuted()}
							class="flex justify-between items-center gap-x-2 w-full"
						>
							<div>
								<CheckboxLabel>Mute</CheckboxLabel>
							</div>
							<CheckboxInput />
							<CheckboxControl />
						</Checkbox>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenu>
	);
};

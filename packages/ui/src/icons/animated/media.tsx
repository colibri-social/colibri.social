import { splitProps } from "solid-js";
import {
	headphonesRound,
	monitorSmartphone0,
	monitorSmartphone1,
	monitorSmartphone2,
	musicLibrary20,
	musicLibrary21,
	musicLibrary22,
	musicLibrary23,
	pause0,
	pause1,
	phoneCallingRounded0,
	phoneCallingRounded1,
	phoneCallingRounded2,
	pip0,
	pip1,
	play,
	radio0,
	radio1,
	radio2,
	screencast0,
	screencast1,
	screencast2,
	screencast3,
	soundwave0,
	soundwave1,
	soundwave2,
	soundwave3,
	soundwave4,
	videocamera,
	volumeLoud0,
	volumeLoud1,
	volumeLoud2,
} from "../solar/media";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	Part,
	Slashed,
	SolarShape,
	Swap,
} from "./AnimatedIcon";

const HEADPHONES_SLASH_PATH = "M21 3.31L1.875 22.44";

export const AnimatedHeadphonesIcon = (
	props: AnimatedIconProps & { deafened?: boolean },
) => {
	const [local, rest] = splitProps(props, ["deafened"]);
	return (
		<AnimatedIcon {...rest} name="headphones" trigger="press">
			<Slashed on={!!local.deafened} path={HEADPHONES_SLASH_PATH}>
				<SolarShape path={headphonesRound} name="headphones" hover="bounce" />
			</Slashed>
		</AnimatedIcon>
	);
};

export const AnimatedVideocameraIcon = (
	props: AnimatedIconProps & { off?: boolean },
) => {
	const [local, rest] = splitProps(props, ["off"]);
	return (
		<AnimatedIcon {...rest} name="videocamera" trigger="press">
			<Slashed on={!!local.off}>
				<SolarShape path={videocamera} name="videocamera" hover="bounce" />
			</Slashed>
		</AnimatedIcon>
	);
};

export type VolumeLevel = "off" | "low" | "high";

export const AnimatedVolumeIcon = (
	props: AnimatedIconProps & { level?: VolumeLevel },
) => {
	const [local, rest] = splitProps(props, ["level"]);
	const level = () => local.level ?? "high";
	return (
		<AnimatedIcon {...rest} name="volume">
			<Slashed on={level() === "off"}>
				<Part name="volume-levels">
					<g data-volume-level={level()}>
						<SolarShape path={volumeLoud0} name="volume-speaker" />
						<SolarShape
							path={volumeLoud2}
							name="volume-wave-inner"
							hover="pop"
							origin="17.4px 12px"
							vars={{ "--fx-scale": "1.25" }}
						/>
						<SolarShape
							path={volumeLoud1}
							name="volume-wave-outer"
							hover="pop"
							origin="19px 12px"
							vars={{ "--fx-scale": "1.25", "--fx-delay": "70ms" }}
						/>
					</g>
				</Part>
			</Slashed>
		</AnimatedIcon>
	);
};

export const AnimatedPhoneCallingIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="phone-calling">
		<SolarShape
			path={phoneCallingRounded0}
			name="phone-handset"
			hover="wiggle"
			attention="wiggle"
			vars={{ "--fx-angle": "8deg" }}
		/>
		<SolarShape
			path={phoneCallingRounded2}
			name="phone-wave-inner"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "520ms" }}
		/>
		<SolarShape
			path={phoneCallingRounded1}
			name="phone-wave-outer"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "520ms", "--fx-delay": "90ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedPauseIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="pause">
		<SolarShape
			path={pause0}
			name="pause-left"
			hover="bounce"
			origin="6px 12px"
			vars={{ "--fx-squish": "0.8" }}
		/>
		<SolarShape
			path={pause1}
			name="pause-right"
			hover="bounce"
			origin="18px 12px"
			vars={{ "--fx-squish": "0.8", "--fx-delay": "60ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedPlayPauseIcon = (
	props: AnimatedIconProps & { playing?: boolean },
) => {
	const [local, rest] = splitProps(props, ["playing"]);
	return (
		<AnimatedIcon {...rest} name="play-pause">
			<Part name="play-pause" hover="bounce">
				<Swap
					showSecond={!!local.playing}
					first={<SolarShape path={play} name="play-pause-play" />}
					second={
						<>
							<SolarShape path={pause0} name="play-pause-left" />
							<SolarShape path={pause1} name="play-pause-right" />
						</>
					}
				/>
			</Part>
		</AnimatedIcon>
	);
};

export const AnimatedMusicLibraryIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="music-library">
		<SolarShape
			path={musicLibrary20}
			name="music-library-back"
			hover="nudge"
			vars={{ "--fx-x": "0px", "--fx-y": "-1.2px", "--fx-delay": "60ms" }}
		/>
		<SolarShape
			path={musicLibrary21}
			name="music-library-middle"
			hover="nudge"
			vars={{ "--fx-x": "0px", "--fx-y": "-0.8px" }}
		/>
		<Part name="music-library-front">
			<SolarShape path={musicLibrary23} name="music-library-case" />
			<SolarShape path={musicLibrary22} name="music-library-dot" />
		</Part>
	</AnimatedIcon>
);

const soundwaveBars = [
	{ path: soundwave3, name: "soundwave-bar-1", x: 4, delay: "0ms" },
	{ path: soundwave1, name: "soundwave-bar-2", x: 8, delay: "90ms" },
	{ path: soundwave0, name: "soundwave-bar-3", x: 12, delay: "180ms" },
	{ path: soundwave2, name: "soundwave-bar-4", x: 16, delay: "270ms" },
	{ path: soundwave4, name: "soundwave-bar-5", x: 20, delay: "360ms" },
];

export const AnimatedSoundwaveIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="soundwave">
		{soundwaveBars.map((bar) => (
			<SolarShape
				path={bar.path}
				name={bar.name}
				origin={`${bar.x}px 12px`}
				vars={{ "--fx-delay": bar.delay }}
			/>
		))}
	</AnimatedIcon>
);

export const AnimatedScreencastIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="screencast">
		<SolarShape path={screencast0} name="screencast-screen" />
		<SolarShape
			path={screencast3}
			name="screencast-wave-1"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "560ms" }}
		/>
		<SolarShape
			path={screencast2}
			name="screencast-wave-2"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "560ms", "--fx-delay": "80ms" }}
		/>
		<SolarShape
			path={screencast1}
			name="screencast-wave-3"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "560ms", "--fx-delay": "160ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedPipIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="pip">
		<SolarShape path={pip1} name="pip-frame" />
		<SolarShape
			path={pip0}
			name="pip-window"
			hover="nudge"
			vars={{ "--fx-x": "-1.2px", "--fx-y": "-1.2px" }}
		/>
	</AnimatedIcon>
);

export const AnimatedMonitorSmartphoneIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="monitor-smartphone">
		<SolarShape path={monitorSmartphone0} name="monitor-screen" />
		<SolarShape path={monitorSmartphone1} name="monitor-stand" />
		<SolarShape
			path={monitorSmartphone2}
			name="monitor-phone"
			hover="hop"
			vars={{ "--fx-y": "1.8px" }}
		/>
	</AnimatedIcon>
);

export const AnimatedRadioIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="radio">
		<SolarShape path={radio2} name="radio-body" />
		<SolarShape
			path={radio0}
			name="radio-dial"
			hover="nudge"
			vars={{ "--fx-x": "1.2px", "--fx-y": "0px" }}
		/>
		<SolarShape
			path={radio1}
			name="radio-knob"
			hover="pop"
			origin="7.5px 17px"
			vars={{ "--fx-scale": "1.4", "--fx-delay": "80ms" }}
		/>
	</AnimatedIcon>
);

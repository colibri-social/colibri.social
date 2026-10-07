import { splitProps } from "solid-js";
import {
	bellBody,
	bellClapper,
	check,
	copyBack,
	copyFront,
	heart,
	microphoneCapsule,
	microphoneStand,
	plane,
	settingsGear,
	trashBin,
	trashLid,
} from "../solar/paths";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	LinearShape,
	Part,
	Slashed,
	SolarShape,
	Swap,
	Turn,
} from "./AnimatedIcon";

export const AnimatedBellIcon = (
	props: AnimatedIconProps & { muted?: boolean },
) => {
	const [local, rest] = splitProps(props, ["muted"]);
	return (
		<AnimatedIcon {...rest} name="bell" trigger="press">
			<Slashed on={!!local.muted}>
				<Part name="bell" hover="bounce">
					<Part name="ringer" attention="wiggle" origin="12px 2.6px">
						<SolarShape path={bellBody} name="body" />
						<SolarShape
							path={bellClapper}
							name="clapper"
							attention="swing"
							origin="12px 2.6px"
						/>
					</Part>
				</Part>
			</Slashed>
		</AnimatedIcon>
	);
};

export const AnimatedMicrophoneIcon = (
	props: AnimatedIconProps & { muted?: boolean },
) => {
	const [local, rest] = splitProps(props, ["muted"]);
	return (
		<AnimatedIcon {...rest} name="microphone" trigger="press">
			<Slashed on={!!local.muted}>
				<Part name="microphone" hover="bounce">
					<SolarShape path={microphoneCapsule} name="capsule" />
					<SolarShape path={microphoneStand} name="stand" />
				</Part>
			</Slashed>
		</AnimatedIcon>
	);
};

export const AnimatedSettingsIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="settings">
		<SolarShape
			path={settingsGear}
			name="gear"
			hover="spin"
			attention="spin"
			loop="spin"
			origin="12.5px 12px"
		/>
	</AnimatedIcon>
);

export const AnimatedCopyIcon = (
	props: AnimatedIconProps & { copied?: boolean },
) => {
	const [local, rest] = splitProps(props, ["copied"]);
	return (
		<AnimatedIcon {...rest} name="copy">
			<Swap
				showSecond={!!local.copied}
				first={
					<>
						<SolarShape path={copyBack} name="back" />
						<SolarShape
							path={copyFront}
							name="front"
							hover="nudge"
							vars={{ "--fx-x": "-1px", "--fx-y": "-1px" }}
						/>
					</>
				}
				second={<SolarShape path={check} name="check" />}
			/>
		</AnimatedIcon>
	);
};

export const AnimatedTrashIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="trash">
		<SolarShape path={trashLid} name="lid" hover="tilt" origin="3.5px 6.4px" />
		<SolarShape path={trashBin} name="bin" attention="shake" />
	</AnimatedIcon>
);

export const AnimatedSendIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="send">
		<SolarShape path={plane} name="plane" hover="nudge" attention="fly" />
	</AnimatedIcon>
);

export const AnimatedChevronIcon = (
	props: AnimatedIconProps & { open?: boolean },
) => {
	const [local, rest] = splitProps(props, ["open"]);
	return (
		<AnimatedIcon {...rest} name="chevron">
			<Turn angle={local.open ? 180 : 0}>
				<LinearShape
					d="M19 9L12 15L5 9"
					name="arrow"
					hover="nudge"
					vars={{ "--fx-x": "0px", "--fx-y": "1.5px" }}
				/>
			</Turn>
		</AnimatedIcon>
	);
};

export const AnimatedHeartIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="heart">
		<SolarShape
			path={heart}
			name="heart"
			hover="bounce"
			attention="pop"
			loop="heartbeat"
			origin="12px 11.89px"
		/>
	</AnimatedIcon>
);

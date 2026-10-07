import { splitProps } from "solid-js";
import {
	bolt,
	bug0,
	bug1,
	inboxTop,
	inboxTray,
	inboxUnread0,
	inboxUnread2,
	pipette0,
	pipette1,
	shareCircle0,
	shareCircle1,
	shareCircle2,
	shareCircle3,
	shareCircle4,
	shareCircle5,
	sun0,
	sun1,
	sunFog0,
	sunFog1,
	sunFog2,
	testTubeMinimalistic0,
	testTubeMinimalistic1,
	tuning20,
	tuning21,
} from "../solar/system";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	Part,
	SolarShape,
} from "./AnimatedIcon";

const TuningTrack = (props: {
	name: string;
	d: string;
	rest: number;
	peak: number;
	delay?: string;
}) => (
	<path
		d={props.d}
		data-part={props.name}
		data-tuning-track=""
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		fill="none"
		style={{
			"--track-rest": `${props.rest}px`,
			"--track-peak": `${props.peak}px`,
			"--fx-delay": props.delay ?? "0ms",
			"stroke-dasharray": `${props.rest}px 100px`,
		}}
	/>
);

export const AnimatedTuningIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="tuning">
		<TuningTrack
			name="track-top-left"
			d="M1.75 6.95852H10"
			rest={7}
			peak={5.5}
		/>
		<TuningTrack
			name="track-top-right"
			d="M21.75 6.95852H16"
			rest={2}
			peak={3.5}
		/>
		<TuningTrack
			name="track-bottom-left"
			d="M1.75 16.9585H8"
			rest={2}
			peak={3.5}
			delay="40ms"
		/>
		<TuningTrack
			name="track-bottom-right"
			d="M21.75 16.9585H13"
			rest={7}
			peak={5.5}
			delay="40ms"
		/>
		<SolarShape
			path={tuning21}
			name="knob-top"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "-1.5px", "--fx-y": "0px" }}
		/>
		<SolarShape
			path={tuning20}
			name="knob-bottom"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "1.5px", "--fx-y": "0px", "--fx-delay": "40ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedBugIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="bug">
		<Part name="bug" hover="hop" attention="shake">
			<SolarShape
				path={bug0}
				name="head"
				hover="wiggle"
				origin="12px 6.7px"
				vars={{ "--fx-angle": "10deg", "--fx-delay": "60ms" }}
			/>
			<SolarShape path={bug1} name="body" />
		</Part>
	</AnimatedIcon>
);

export const AnimatedTestTubeIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="test-tube">
		<Part
			name="tube"
			hover="wiggle"
			attention="wiggle"
			origin="19px 5px"
			vars={{ "--fx-angle": "8deg" }}
		>
			<SolarShape path={testTubeMinimalistic0} name="glass" />
			<SolarShape
				path={testTubeMinimalistic1}
				name="liquid"
				attention="pulse"
			/>
		</Part>
	</AnimatedIcon>
);

export const AnimatedInboxIcon = (
	props: AnimatedIconProps & { unread?: boolean },
) => {
	const [local, rest] = splitProps(props, ["unread"]);
	return (
		<AnimatedIcon {...rest} name="inbox">
			<g data-inbox-unread={local.unread ? "on" : "off"}>
				<Part name="lid">
					<g data-inbox-read-top="">
						<SolarShape path={inboxTop} name="top" />
					</g>
					<g data-inbox-unread-top="">
						<SolarShape path={inboxUnread2} name="top-unread" />
					</g>
					<g data-inbox-dot="">
						<SolarShape path={inboxUnread0} name="dot" />
					</g>
				</Part>
			</g>
			<SolarShape path={inboxTray} name="tray" />
		</AnimatedIcon>
	);
};

export const AnimatedSunIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="sun">
		<SolarShape
			path={sun1}
			name="rays"
			hover="spin"
			attention="spin"
			loop="spin"
			origin="12px 12px"
			vars={{ "--fx-angle": "90deg", "--fx-duration": "620ms" }}
		/>
		<SolarShape
			path={sun0}
			name="core"
			hover="bounce"
			origin="12px 12px"
			vars={{ "--fx-squish": "0.9", "--fx-scale": "1.06" }}
		/>
	</AnimatedIcon>
);

export const AnimatedSunFogIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="sun-fog">
		<SolarShape
			path={sunFog2}
			name="sun"
			hover="hop"
			attention="hop"
			vars={{ "--fx-y": "1px" }}
		/>
		<SolarShape
			path={sunFog1}
			name="fog"
			hover="swing"
			vars={{ "--fx-x": "1.2px" }}
		/>
		<SolarShape
			path={sunFog0}
			name="fog-low"
			hover="swing"
			vars={{ "--fx-x": "-1.2px", "--fx-delay": "40ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedBoltIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="bolt">
		<SolarShape path={bolt} name="bolt" loop="pulse" />
	</AnimatedIcon>
);

export const AnimatedPipetteIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="pipette">
		<Part
			name="pipette"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "-1px", "--fx-y": "1px" }}
		>
			<SolarShape
				path={pipette0}
				name="bulb"
				hover="bounce"
				origin="15.88px 8.13px"
				vars={{ "--fx-squish": "0.84", "--fx-scale": "1.04" }}
			/>
			<SolarShape path={pipette1} name="tip" />
		</Part>
	</AnimatedIcon>
);

export const AnimatedShareCircleIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="share-circle">
		<SolarShape path={shareCircle3} name="link-left" />
		<SolarShape path={shareCircle4} name="link-right" />
		<SolarShape path={shareCircle5} name="link-bottom" />
		<SolarShape
			path={shareCircle0}
			name="node-top"
			hover="pop"
			attention="pop"
			origin="12px 6px"
			vars={{ "--fx-scale": "1.25" }}
		/>
		<SolarShape
			path={shareCircle2}
			name="node-right"
			hover="pop"
			attention="pop"
			origin="18.5px 18px"
			vars={{ "--fx-scale": "1.25", "--fx-delay": "70ms" }}
		/>
		<SolarShape
			path={shareCircle1}
			name="node-left"
			hover="pop"
			attention="pop"
			origin="5.5px 18px"
			vars={{ "--fx-scale": "1.25", "--fx-delay": "140ms" }}
		/>
	</AnimatedIcon>
);

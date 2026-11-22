import { createUniqueId, splitProps } from "solid-js";
import {
	crown0,
	crown1,
	eye0,
	eye1,
	handShake0,
	handShake1,
	handShake2,
	handStars0,
	handStars1,
	handStars2,
	handStars3,
	lock,
	lockUnlocked,
	login20,
	login21,
	logout20,
	logout21,
	sledgehammer0,
	sledgehammer1,
	sledgehammer2,
	user0,
	user1,
	userCircleBody,
	userCircleDisk,
	userCircleHead,
	userMinusRounded0,
	userMinusRounded1,
	userMinusRounded2,
	userSpeak0,
	userSpeak1,
	userSpeak2,
	userSpeak3,
	usersGroupTwoRounded0,
	usersGroupTwoRounded1,
	usersGroupTwoRounded2,
	usersGroupTwoRounded3,
	usersGroupTwoRounded4,
	usersGroupTwoRounded5,
} from "../solar/people";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	Part,
	Slashed,
	SolarShape,
} from "./AnimatedIcon";

export const AnimatedUserIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="user">
		<SolarShape
			path={user0}
			name="body"
			hover="hop"
			vars={{ "--fx-y": "0.8px" }}
		/>
		<SolarShape
			path={user1}
			name="head"
			hover="hop"
			vars={{ "--fx-delay": "40ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedUserMinusRoundedIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="user-minus">
		<SolarShape
			path={userMinusRounded1}
			name="body"
			hover="hop"
			vars={{ "--fx-y": "0.8px" }}
		/>
		<SolarShape
			path={userMinusRounded2}
			name="head"
			hover="hop"
			vars={{ "--fx-delay": "40ms" }}
		/>
		<SolarShape
			path={userMinusRounded0}
			name="badge"
			hover="pop"
			attention="shake"
			origin="16.5px 18.5px"
			vars={{ "--fx-delay": "60ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedUsersGroupTwoRoundedIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="users-group">
		<Part
			name="back-left"
			hover="hop"
			attention="hop"
			vars={{ "--fx-y": "1px", "--fx-delay": "90ms" }}
		>
			<SolarShape path={usersGroupTwoRounded1} name="back-left-body" />
			<SolarShape path={usersGroupTwoRounded4} name="back-left-head" />
		</Part>
		<Part
			name="back-right"
			hover="hop"
			attention="hop"
			vars={{ "--fx-y": "1px", "--fx-delay": "90ms" }}
		>
			<SolarShape path={usersGroupTwoRounded2} name="back-right-body" />
			<SolarShape path={usersGroupTwoRounded5} name="back-right-head" />
		</Part>
		<Part name="front" hover="hop" attention="hop">
			<SolarShape path={usersGroupTwoRounded0} name="front-body" />
			<SolarShape path={usersGroupTwoRounded3} name="front-head" />
		</Part>
	</AnimatedIcon>
);

export const AnimatedUserSpeakIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="user-speak">
		<SolarShape path={userSpeak2} name="body" />
		<SolarShape
			path={userSpeak1}
			name="head"
			hover="hop"
			vars={{ "--fx-y": "0.8px" }}
		/>
		<SolarShape
			path={userSpeak3}
			name="wave-inner"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "560ms" }}
		/>
		<SolarShape
			path={userSpeak0}
			name="wave-outer"
			hover="pulse"
			attention="pulse"
			vars={{ "--fx-duration": "560ms", "--fx-delay": "120ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedCrownIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="crown">
		<SolarShape
			path={crown0}
			name="crown"
			hover="hop"
			attention="wiggle"
			origin="12px 17px"
			vars={{ "--fx-y": "2px", "--fx-angle": "8deg" }}
		/>
		<SolarShape path={crown1} name="base" />
	</AnimatedIcon>
);

export const AnimatedSledgehammerIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="sledgehammer">
		<Part name="hammer" origin="4.5px 21.5px">
			<SolarShape path={sledgehammer0} name="grip" />
			<SolarShape path={sledgehammer1} name="head" />
			<SolarShape path={sledgehammer2} name="shine" />
		</Part>
	</AnimatedIcon>
);

export const AnimatedHandShakeIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="hand-shake">
		<SolarShape path={handShake0} name="motion-low" origin="6.78px 20.25px" />
		<SolarShape path={handShake1} name="motion-high" origin="17.13px 2.7px" />
		<SolarShape path={handShake2} name="hand" origin="13px 19px" />
	</AnimatedIcon>
);

export const AnimatedHandStarsIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="hand-stars">
		<SolarShape path={handStars0} name="hand" />
		<SolarShape
			path={handStars1}
			name="star-left"
			hover="pop"
			attention="pop"
			origin="4px 9px"
		/>
		<SolarShape
			path={handStars3}
			name="star-top"
			hover="pop"
			attention="pop"
			origin="12px 6px"
			vars={{ "--fx-delay": "80ms" }}
		/>
		<SolarShape
			path={handStars2}
			name="star-right"
			hover="pop"
			attention="pop"
			origin="20px 9px"
			vars={{ "--fx-delay": "160ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedLogoutIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="logout">
		<SolarShape path={logout21} name="door" />
		<SolarShape
			path={logout20}
			name="arrow"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "-1.8px", "--fx-y": "0px" }}
		/>
	</AnimatedIcon>
);

export const AnimatedLoginIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="login">
		<SolarShape path={login21} name="door" />
		<SolarShape
			path={login20}
			name="arrow"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "1.8px", "--fx-y": "0px" }}
		/>
	</AnimatedIcon>
);

export const AnimatedLockIcon = (
	props: AnimatedIconProps & { locked?: boolean },
) => {
	const [local, rest] = splitProps(props, ["locked"]);
	return (
		<AnimatedIcon {...rest} name="lock" trigger="press">
			<Part
				name="lock"
				hover="hop"
				attention="shake"
				vars={{ "--fx-y": "1px" }}
			>
				<g data-lock={local.locked === false ? "open" : "closed"}>
					<SolarShape path={lock} name="closed" />
					<SolarShape path={lockUnlocked} name="open" />
				</g>
			</Part>
		</AnimatedIcon>
	);
};

const EYE_OUTLINE = eye1.d.slice(0, eye1.d.indexOf("Z") + 1);

export const AnimatedEyeIcon = (
	props: AnimatedIconProps & { hidden?: boolean },
) => {
	const [local, rest] = splitProps(props, ["hidden"]);
	const irisMask = `eye-iris-${createUniqueId()}`;
	return (
		<AnimatedIcon {...rest} name="eye">
			<Slashed on={!!local.hidden}>
				<mask
					id={irisMask}
					maskUnits="userSpaceOnUse"
					x="0"
					y="0"
					width="24"
					height="24"
				>
					<rect width="24" height="24" fill="white" />
					<circle cx="12" cy="12" r="3.75" fill="black" data-part="iris-hole" />
				</mask>
				<path d={EYE_OUTLINE} fill="currentColor" mask={`url(#${irisMask})`} />
				<SolarShape path={eye0} name="pupil" />
			</Slashed>
		</AnimatedIcon>
	);
};

export const AnimatedProfileIcon = (props: AnimatedIconProps) => {
	const cutoutMask = `profile-cutout-${createUniqueId()}`;
	return (
		<AnimatedIcon {...props} name="profile">
			<mask
				id={cutoutMask}
				maskUnits="userSpaceOnUse"
				x="0"
				y="0"
				width="24"
				height="24"
			>
				<rect width="24" height="24" fill="white" />
				<Part name="head">
					<path d={userCircleHead.d} fill="black" />
				</Part>
				<path d={userCircleBody.d} fill="black" />
			</mask>
			<path
				d={userCircleDisk.d}
				fill="currentColor"
				mask={`url(#${cutoutMask})`}
			/>
		</AnimatedIcon>
	);
};

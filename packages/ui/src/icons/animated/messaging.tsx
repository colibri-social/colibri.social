import { createUniqueId, For } from "solid-js";
import {
	bellRing0,
	bellRing1,
	checkReadLinear0,
	checkReadLinear1,
	code0,
	code1,
	code2,
	galleryAdd0,
	galleryAdd1,
	like0,
	like1,
	linkMinimalistic20,
	linkMinimalistic21,
	linkMinimalistic22,
	notes0,
	notes1,
	stars0,
	stars1,
	textCross0,
	textCross1,
	textCross2,
	textUnderline0,
	textUnderline1,
	unlinkMinimalistic0,
	unlinkMinimalistic1,
	unlinkMinimalistic2,
	unlinkMinimalistic3,
} from "../solar/messaging";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	LinearShape,
	Part,
	SolarShape,
} from "./AnimatedIcon";

const SQUARE_BUBBLE =
	"M13.0867 21.3877L13.6288 20.4718C14.0492 19.7614 14.2595 19.4062 14.5972 19.2098C14.9349 19.0134 15.36 19.0061 16.2104 18.9915C17.4658 18.9698 18.2531 18.8929 18.9134 18.6194C20.1386 18.1119 21.1119 17.1386 21.6194 15.9134C22 14.9946 22 13.8297 22 11.5V10.5C22 7.22657 22 5.58985 21.2632 4.38751C20.8509 3.71473 20.2853 3.14908 19.6125 2.7368C18.4101 2 16.7734 2 13.5 2H10.5C7.22657 2 5.58985 2 4.38751 2.7368C3.71473 3.14908 3.14908 3.71473 2.7368 4.38751C2 5.58985 2 7.22657 2 10.5V11.5C2 13.8297 2 14.9946 2.3806 15.9134C2.88807 17.1386 3.86144 18.1119 5.08658 18.6194C5.74689 18.8929 6.53422 18.9698 7.78958 18.9915C8.63992 19.0061 9.06509 19.0134 9.40279 19.2098C9.74049 19.4063 9.95073 19.7614 10.3712 20.4718L10.9133 21.3877C11.3965 22.204 12.6035 22.204 13.0867 21.3877Z";

const ROUND_BUBBLE =
	"M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C10.4003 22 8.88867 21.6239 7.54785 20.9561C7.19153 20.7786 6.78396 20.7204 6.39941 20.8232L4.17383 21.4189C3.20749 21.6775 2.3225 20.7925 2.58105 19.8262L3.17676 17.6006C3.27965 17.216 3.22142 16.8085 3.04395 16.4521C2.37612 15.1113 2 13.5997 2 12C2 6.47715 6.47715 2 12 2Z";

const TYPING_DELAYS = ["0ms", "90ms", "180ms"];

const DottedBubble = (props: {
	bubble: string;
	dotsX: [number, number, number];
	dotY: number;
}) => {
	const maskId = `chat-dots-${createUniqueId()}`;
	return (
		<>
			<mask
				id={maskId}
				maskUnits="userSpaceOnUse"
				x="0"
				y="0"
				width="24"
				height="24"
			>
				<rect x="0" y="0" width="24" height="24" fill="white" />
				<For each={props.dotsX}>
					{(x, index) => (
						<circle
							cx={x}
							cy={props.dotY}
							r="1"
							fill="black"
							data-part={`dot-${index()}`}
							data-hover-fx="hop"
							data-attention-fx="hop"
							style={{
								"--fx-y": "1px",
								"--fx-delay": TYPING_DELAYS[index()],
							}}
						/>
					)}
				</For>
			</mask>
			<path
				d={props.bubble}
				fill="currentColor"
				mask={`url(#${maskId})`}
				data-part="bubble"
			/>
		</>
	);
};

export const AnimatedChatSquareDotsIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="chat-square-dots">
		<DottedBubble bubble={SQUARE_BUBBLE} dotsX={[8, 12, 16]} dotY={11} />
	</AnimatedIcon>
);

export const AnimatedChatRoundDotsIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="chat-round-dots">
		<DottedBubble bubble={ROUND_BUBBLE} dotsX={[7.99, 12, 16.01]} dotY={12} />
	</AnimatedIcon>
);

export const AnimatedGalleryAddIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="gallery-add">
		<SolarShape path={galleryAdd0} name="picture" attention="bounce" />
		<SolarShape
			path={galleryAdd1}
			name="plus"
			hover="spin"
			attention="pop"
			origin="17.5px 6.5px"
			vars={{ "--fx-angle": "90deg", "--fx-duration": "480ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedNotesIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="notes">
		<SolarShape
			path={notes1}
			name="back"
			hover="nudge"
			vars={{ "--fx-x": "1px", "--fx-y": "-1px" }}
		/>
		<SolarShape
			path={notes0}
			name="front"
			hover="nudge"
			vars={{ "--fx-x": "-1px", "--fx-y": "1px" }}
		/>
	</AnimatedIcon>
);

export const AnimatedCheckReadIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="check-read">
		<LinearShape
			d={checkReadLinear0.d}
			name="first"
			hover="draw"
			attention="draw"
		/>
		<LinearShape
			d={checkReadLinear1.d}
			name="second"
			hover="draw"
			attention="draw"
			vars={{ "--fx-delay": "90ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedLinkIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="link">
		<SolarShape
			path={linkMinimalistic20}
			name="upper"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "-0.8px", "--fx-y": "0.8px" }}
		/>
		<SolarShape
			path={linkMinimalistic21}
			name="lower"
			hover="nudge"
			attention="nudge"
			vars={{ "--fx-x": "0.8px", "--fx-y": "-0.8px" }}
		/>
		<SolarShape path={linkMinimalistic22} name="bar" />
	</AnimatedIcon>
);

export const AnimatedUnlinkIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="unlink">
		<SolarShape
			path={unlinkMinimalistic0}
			name="upper"
			hover="nudge"
			attention="shake"
			vars={{ "--fx-x": "1px", "--fx-y": "-1px" }}
		/>
		<SolarShape
			path={unlinkMinimalistic1}
			name="lower"
			hover="nudge"
			attention="shake"
			vars={{ "--fx-x": "-1px", "--fx-y": "1px" }}
		/>
		<Part name="sparks" hover="pulse" attention="pulse">
			<SolarShape path={unlinkMinimalistic2} name="spark-top" />
			<SolarShape path={unlinkMinimalistic3} name="spark-left" />
		</Part>
	</AnimatedIcon>
);

export const AnimatedLikeIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="like">
		<Part name="thumb" attention="bounce">
			<SolarShape path={like0} name="cuff" />
			<SolarShape
				path={like1}
				name="hand"
				hover="tilt"
				origin="7px 20px"
				vars={{ "--fx-x": "0px", "--fx-y": "-0.6px", "--fx-angle": "-10deg" }}
			/>
		</Part>
	</AnimatedIcon>
);

export const AnimatedStarsIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="stars">
		<SolarShape
			path={stars1}
			name="large"
			hover="pop"
			attention="pop"
			origin="8.5px 8.5px"
			vars={{ "--fx-scale": "1.18" }}
		/>
		<SolarShape
			path={stars0}
			name="small"
			hover="pop"
			attention="pop"
			origin="17.5px 17.5px"
			vars={{ "--fx-scale": "1.25", "--fx-delay": "120ms" }}
		/>
	</AnimatedIcon>
);

export const AnimatedTextUnderlineIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="text-underline">
		<SolarShape
			path={textUnderline0}
			name="letter"
			hover="hop"
			vars={{ "--fx-y": "1.2px" }}
		/>
		<SolarShape path={textUnderline1} name="underline" origin="3px 21px" />
	</AnimatedIcon>
);

export const AnimatedTextStrikethroughIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="text-strikethrough">
		<SolarShape path={textCross0} name="top" />
		<SolarShape path={textCross1} name="bottom" />
		<SolarShape path={textCross2} name="strike" origin="3px 12px" />
	</AnimatedIcon>
);

export const AnimatedCodeIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="code">
		<SolarShape
			path={code2}
			name="left"
			hover="nudge"
			vars={{ "--fx-x": "-1.2px", "--fx-y": "0px" }}
		/>
		<SolarShape
			path={code1}
			name="right"
			hover="nudge"
			vars={{ "--fx-x": "1.2px", "--fx-y": "0px" }}
		/>
		<SolarShape
			path={code0}
			name="slash"
			hover="wiggle"
			origin="12px 12.43px"
			vars={{ "--fx-angle": "8deg" }}
		/>
	</AnimatedIcon>
);

export const AnimatedBellRingIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="bell-ring">
		<Part name="ringer" hover="wiggle" attention="wiggle" origin="12px 2.6px">
			<SolarShape path={bellRing1} name="body" />
			<SolarShape
				path={bellRing0}
				name="clapper"
				hover="swing"
				attention="swing"
				origin="12px 2.6px"
			/>
		</Part>
	</AnimatedIcon>
);

export const AnimatedThreadIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="thread" viewBox="0 0 192 192">
		<g transform="translate(96.44 96.27) rotate(45) translate(-50 -72)">
			<Part
				name="spool-top"
				hover="nudge"
				attention="nudge"
				vars={{
					"--fx-x": "0px",
					"--fx-y": "-12px",
					"--fx-duration": "480ms",
				}}
			>
				<path
					d="M0 12C0 5.37258 5.37258 0 12 0H88C94.6274 0 100 5.37258 100 12C100 18.6274 94.6274 24 88 24H12C5.37258 24 0 18.6274 0 12Z"
					fill="currentColor"
				/>
				<path
					d="M8.86859 57.1305C7.00134 53.1262 8.73378 48.3663 12.7381 46.4991L84.8686 9.01733C88.8729 7.15009 93.6327 8.88253 95.5 12.8868C97.3672 16.8912 97.5043 20.8009 93.5 22.6682L19.5 61C15.4957 62.8672 10.7358 61.1348 8.86859 57.1305Z"
					fill="currentColor"
				/>
			</Part>
			<rect
				x="6.57284"
				y="87.4715"
				width="90.5854"
				height="16.7031"
				rx="8.35153"
				transform="rotate(-30 6.57284 87.4715)"
				fill="currentColor"
			/>
			<Part
				name="spool-bottom"
				hover="nudge"
				attention="nudge"
				vars={{
					"--fx-x": "0px",
					"--fx-y": "12px",
					"--fx-duration": "480ms",
				}}
			>
				<path
					d="M100 132.001C100 138.629 94.6274 144.001 88 144.001H12C5.37258 144.001 0 138.629 0 132.001C0 125.374 5.37258 120.001 12 120.001H88C94.6274 120.001 100 125.374 100 132.001Z"
					fill="currentColor"
				/>
				<path
					d="M91.1314 86.871C92.9987 90.8753 91.2662 95.6351 87.2619 97.5024L15.1314 134.984C11.1271 136.851 6.36727 135.119 4.50002 131.115C2.63278 127.11 2.49568 123.201 6.5 121.333L80.5 83.0015C84.5043 81.1342 89.2642 82.8667 91.1314 86.871Z"
					fill="currentColor"
				/>
			</Part>
		</g>
	</AnimatedIcon>
);

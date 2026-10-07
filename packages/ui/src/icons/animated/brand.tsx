import { createUniqueId, For, type JSX, splitProps } from "solid-js";
import {
	atmosphereAt,
	atmosphereRing,
	blueskyButterfly,
	heroiconsGif,
	pdslsColor,
	pdslsMark,
	playTesterBadgeGradient,
	playTesterBadgeMark,
} from "../solar/brand";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	LinearShape,
	Part,
	SolarShape,
} from "./AnimatedIcon";

const PDSLS_VIEWBOX = "0 0 16 16";
const PLAY_TESTER_BADGE_VIEWBOX = "0 0 16 16";
const GIF_VIEWBOX = "0 0 20 20";
const BLUESKY_VIEWBOX = "-2.4 -3.80625 28.8 28.8";
const BLUESKY_ORIGIN = "12px 10.57px";

const PlayTesterBadgeMark = () => {
	const maskId = `play-tester-badge-mask-${createUniqueId()}`;
	const gradientId = `play-tester-badge-gradient-${createUniqueId()}`;
	return (
		<>
			<defs>
				<linearGradient
					id={gradientId}
					x1="9"
					y1="14.6667"
					x2="9"
					y2="1.33333"
					gradientUnits="userSpaceOnUse"
				>
					<For each={playTesterBadgeGradient}>
						{(stop) => <stop offset={stop.offset} stop-color={stop.color} />}
					</For>
				</linearGradient>
				<mask id={maskId} fill="white">
					<path d={playTesterBadgeMark} />
				</mask>
			</defs>
			<path
				d={playTesterBadgeMark}
				stroke-width="4"
				stroke={`url(#${gradientId})`}
				mask={`url(#${maskId})`}
			/>
		</>
	);
};

const BlueskyWings = (props: { animated: boolean }) => {
	const leftId = `bluesky-left-${createUniqueId()}`;
	const rightId = `bluesky-right-${createUniqueId()}`;
	const wing = (side: "left" | "right", clipId: string) => {
		const shape = (
			<path
				d={blueskyButterfly.d}
				fill="currentColor"
				clip-path={`url(#${clipId})`}
			/>
		);
		return props.animated ? (
			<Part name={`wing-${side}`} origin={BLUESKY_ORIGIN}>
				{shape}
			</Part>
		) : (
			shape
		);
	};
	return (
		<>
			<defs>
				<clipPath id={leftId}>
					<rect x="-1" y="-1" width="13" height="24" />
				</clipPath>
				<clipPath id={rightId}>
					<rect x="12" y="-1" width="13" height="24" />
				</clipPath>
			</defs>
			{wing("left", leftId)}
			{wing("right", rightId)}
		</>
	);
};

export const AnimatedBlueskyIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="bluesky" viewBox={BLUESKY_VIEWBOX}>
		<Part name="butterfly" attention="bounce" origin={BLUESKY_ORIGIN}>
			<BlueskyWings animated />
		</Part>
	</AnimatedIcon>
);

export const AnimatedAtmosphereIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="atmosphere">
		<LinearShape d={atmosphereRing} name="ring" attention="draw" />
		<LinearShape
			d={atmosphereAt}
			name="at"
			hover="spin"
			attention="spin"
			origin="12px 12px"
			vars={{ "--fx-angle": "-360deg" }}
		/>
	</AnimatedIcon>
);

export const AnimatedGifIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="gif" viewBox={GIF_VIEWBOX}>
		<SolarShape
			path={heroiconsGif}
			name="gif"
			hover="pop"
			attention="bounce"
			origin="10px 10px"
			vars={{ "--fx-scale": "1.1" }}
		/>
	</AnimatedIcon>
);

export type LogoProps = Omit<
	JSX.SvgSVGAttributes<SVGSVGElement>,
	"children"
> & {
	size?: number | string;
	label?: string;
};

const StaticLogo = (
	props: LogoProps & { viewBox: string; children: JSX.Element },
) => {
	const [local, rest] = splitProps(props, [
		"size",
		"label",
		"viewBox",
		"children",
	]);
	return (
		<svg
			{...rest}
			viewBox={local.viewBox}
			width={local.size ?? 24}
			height={local.size ?? 24}
			fill="none"
			role={local.label ? "img" : undefined}
			aria-label={local.label}
			aria-hidden={local.label ? undefined : "true"}
		>
			{local.children}
		</svg>
	);
};

export const PdslsLogo = (props: LogoProps) => (
	<StaticLogo {...props} viewBox={PDSLS_VIEWBOX}>
		<path d={pdslsMark.d} fill={pdslsColor} />
	</StaticLogo>
);

export const BlueskyLogo = (props: LogoProps) => (
	<StaticLogo {...props} viewBox={BLUESKY_VIEWBOX}>
		<path d={blueskyButterfly.d} fill="currentColor" />
	</StaticLogo>
);

export const PlayTesterBadge = (props: LogoProps) => (
	<StaticLogo {...props} viewBox={PLAY_TESTER_BADGE_VIEWBOX}>
		<PlayTesterBadgeMark />
	</StaticLogo>
);

export const AtmosphereGlyph = (props: LogoProps) => (
	<StaticLogo {...props} viewBox="0 0 24 24">
		<path d={atmosphereRing} stroke="currentColor" stroke-width="1.5" />
		<path
			d={atmosphereAt}
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	</StaticLogo>
);

export const GifGlyph = (props: LogoProps) => (
	<StaticLogo {...props} viewBox={GIF_VIEWBOX}>
		<path
			d={heroiconsGif.d}
			fill="currentColor"
			fill-rule="evenodd"
			clip-rule="evenodd"
		/>
	</StaticLogo>
);

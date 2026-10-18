import { splitProps } from "solid-js";
import {
	navAdd,
	navDownload0,
	navDownload1,
	navMaximize0,
	navMaximize1,
	navTransferHorizontal0,
	navTransferHorizontal1,
	navTransferVertical0,
	navTransferVertical1,
	navUpload0,
	navUpload1,
} from "../solar/navigation";
import type { SolarPath } from "../solar/paths";
import {
	AnimatedIcon,
	type AnimatedIconProps,
	type HoverEffect,
	LinearShape,
	SolarShape,
	Turn,
} from "./AnimatedIcon";

const nudge = (x: string, y: string) => ({ "--fx-x": x, "--fx-y": y });
const delay = (ms: number) => ({ "--fx-delay": `${ms}ms` });

const _NudgeIcon = (
	props: AnimatedIconProps & {
		iconName: string;
		path: SolarPath;
		x: string;
		y: string;
	},
) => {
	const [local, rest] = splitProps(props, ["iconName", "path", "x", "y"]);
	return (
		<AnimatedIcon {...rest} name={local.iconName}>
			<SolarShape
				path={local.path}
				name="glyph"
				hover="nudge"
				attention="nudge"
				vars={nudge(local.x, local.y)}
			/>
		</AnimatedIcon>
	);
};

const _LinearNudgeIcon = (
	props: AnimatedIconProps & {
		iconName: string;
		d: string;
		x: string;
		y: string;
	},
) => {
	const [local, rest] = splitProps(props, ["iconName", "d", "x", "y"]);
	return (
		<AnimatedIcon {...rest} name={local.iconName}>
			<LinearShape
				d={local.d}
				name="glyph"
				hover="nudge"
				attention="nudge"
				vars={nudge(local.x, local.y)}
			/>
		</AnimatedIcon>
	);
};

const CHEVRON_RIGHT = "M9 5L15 12L9 19";

export const AnimatedCaretIcon = (
	props: AnimatedIconProps & { open?: boolean },
) => {
	const [local, rest] = splitProps(props, ["open"]);
	return (
		<AnimatedIcon {...rest} name="caret">
			<Turn angle={local.open ? 90 : 0}>
				<LinearShape
					d={CHEVRON_RIGHT}
					name="caret"
					hover="nudge"
					vars={nudge("1px", "0px")}
				/>
			</Turn>
		</AnimatedIcon>
	);
};

export const AnimatedAddIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="add">
		<SolarShape
			path={navAdd}
			name="plus"
			hover="spin"
			attention="pop"
			vars={{ "--fx-angle": "90deg", "--fx-duration": "420ms" }}
		/>
	</AnimatedIcon>
);

const _dotParts = (
	paths: SolarPath[],
	origins: string[],
	effect: HoverEffect,
	extra: Record<`--fx-${string}`, string>,
) =>
	paths.map((path, index) => (
		<SolarShape
			path={path}
			name={`dot-${index}`}
			hover={effect}
			attention={effect}
			origin={origins[index]}
			vars={{ ...extra, ...delay(index * 60) }}
		/>
	));

export const AnimatedMaximizeIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="maximize">
		<SolarShape
			path={navMaximize0}
			name="top-right"
			hover="nudge"
			vars={nudge("1.5px", "-1.5px")}
		/>
		<SolarShape
			path={navMaximize1}
			name="bottom-left"
			hover="nudge"
			vars={nudge("-1.5px", "1.5px")}
		/>
	</AnimatedIcon>
);

export const AnimatedTransferHorizontalIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="transfer-horizontal">
		<SolarShape
			path={navTransferHorizontal0}
			name="left"
			hover="nudge"
			vars={nudge("-1.5px", "0px")}
		/>
		<SolarShape
			path={navTransferHorizontal1}
			name="right"
			hover="nudge"
			vars={{ ...nudge("1.5px", "0px"), ...delay(60) }}
		/>
	</AnimatedIcon>
);

export const AnimatedTransferVerticalIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="transfer-vertical">
		<SolarShape
			path={navTransferVertical0}
			name="down"
			hover="nudge"
			vars={nudge("0px", "1.5px")}
		/>
		<SolarShape
			path={navTransferVertical1}
			name="up"
			hover="nudge"
			vars={{ ...nudge("0px", "-1.5px"), ...delay(60) }}
		/>
	</AnimatedIcon>
);

export const AnimatedUploadIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="upload">
		<SolarShape
			path={navUpload0}
			name="arrow"
			hover="nudge"
			attention="nudge"
			vars={nudge("0px", "-1.5px")}
		/>
		<SolarShape path={navUpload1} name="tray" />
	</AnimatedIcon>
);

export const AnimatedDownloadIcon = (props: AnimatedIconProps) => (
	<AnimatedIcon {...props} name="download">
		<SolarShape
			path={navDownload0}
			name="arrow"
			hover="nudge"
			attention="nudge"
			vars={nudge("0px", "1.5px")}
		/>
		<SolarShape path={navDownload1} name="tray" />
	</AnimatedIcon>
);

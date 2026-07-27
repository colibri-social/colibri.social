import { type Component, For, type ParentComponent } from "solid-js";
import { Anisota } from "../../../src/components/icons/Anisota";
import { Blacksky } from "../../../src/components/icons/Blacksky";
import { Bluesky } from "../../../src/components/icons/Bluesky";
import { Camera } from "../../../src/components/icons/Camera";
import { Chevron } from "../../../src/components/icons/Chevron";
import { DeerSocial } from "../../../src/components/icons/DeerSocial";
import { Ear } from "../../../src/components/icons/Ear";
import { Image } from "../../../src/components/icons/Image";
import { Microphone } from "../../../src/components/icons/Microphone";
import { MuSocial } from "../../../src/components/icons/MuSocial";
import { PDSls } from "../../../src/components/icons/PDSls";
import { Plus } from "../../../src/components/icons/Plus";
import { Screen } from "../../../src/components/icons/Screen";
import { Spinner } from "../../../src/components/icons/Spinner";
import { Wifi } from "../../../src/components/icons/Wifi";
import { Witchsky } from "../../../src/components/icons/Witchsky";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const PLAIN_ICONS: Array<[string, Component<{ className?: string }>]> = [
	["Anisota", Anisota],
	["Blacksky", Blacksky],
	["Bluesky", Bluesky],
	["Chevron", Chevron],
	["DeerSocial", DeerSocial],
	["Image", Image],
	["MuSocial", MuSocial],
	["PDSls", PDSls],
	["Plus", Plus],
	["Spinner", Spinner],
	["Witchsky", Witchsky],
];

const TOGGLE_ICONS: Array<
	[string, Component<{ className?: string; enabled: boolean }>]
> = [
	["Camera", Camera],
	["Ear", Ear],
	["Microphone", Microphone],
	["Screen", Screen],
];

const WIFI_QUALITIES = [
	"unknown",
	"excellent",
	"good",
	"poor",
	"lost",
] as const;

const IconTile: ParentComponent<{ name: string }> = (props) => (
	<div class="flex flex-col items-center gap-2">
		{props.children}
		<span class="text-muted-foreground text-xs">{props.name}</span>
	</div>
);

const IconsDemo = () => (
	<>
		<Demo label="Icons">
			<div class="grid w-full grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
				<For each={PLAIN_ICONS}>
					{([name, Icon]) => (
						<IconTile name={name}>
							<Icon className="h-6 w-6" />
						</IconTile>
					)}
				</For>
			</div>
		</Demo>
		<Demo label="Enabled and disabled">
			<div class="grid w-full grid-cols-4 gap-4 sm:grid-cols-8">
				<For each={TOGGLE_ICONS}>
					{([name, Icon]) => (
						<>
							<IconTile name={`${name} on`}>
								<Icon className="h-6 w-6" enabled />
							</IconTile>
							<IconTile name={`${name} off`}>
								<Icon className="h-6 w-6" enabled={false} />
							</IconTile>
						</>
					)}
				</For>
			</div>
		</Demo>
		<Demo label="Wifi connection quality">
			<div class="grid w-full grid-cols-5 gap-4">
				<For each={WIFI_QUALITIES}>
					{(quality) => (
						<IconTile name={quality}>
							<Wifi className="h-6 w-6" quality={quality} />
						</IconTile>
					)}
				</For>
			</div>
		</Demo>
	</>
);

export const ICONS: SandboxCategory = {
	id: "icons",
	title: "Icons",
	items: [{ id: "icons", title: "Icons", component: IconsDemo }],
};

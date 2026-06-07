import { type Component, createSignal, Match, Show, Switch } from "solid-js";
import CheckIcon from "~icons/ph/check";
import CopyIcon from "~icons/ph/copy";
import { AtURI } from "../../../utils/at-uri";
import { Button } from "../../ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../ui/Tooltip";
import { SettingsPage } from "./SettingsModal";

const CopyButton: Component<{ value: string }> = (props) => {
	const [active, setActive] = createSignal(false);

	const copyToClipboard = () => {
		navigator.clipboard.writeText(props.value);
		setActive(true);
		setTimeout(() => setActive(false), 2000);
	};

	return (
		<Tooltip>
			<TooltipTrigger class="w-6 h-6 p-0">
				<Button
					size="sm"
					class="w-6 h-6 cursor-pointer"
					classList={{
						"text-green-500 hover:text-green-500": active(),
					}}
					variant="ghost"
					onClick={copyToClipboard}
				>
					<Switch>
						<Match when={active()}>
							<CheckIcon />
						</Match>
						<Match when={!active()}>
							<CopyIcon />
						</Match>
					</Switch>
				</Button>
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent>
					<p
						class="m-0"
						classList={{
							"text-green-500": active(),
						}}
					>
						<Switch>
							<Match when={active()}>Copied!</Match>
							<Match when={!active()}>Copy to clipboard</Match>
						</Switch>
					</p>
				</TooltipContent>
			</TooltipPortal>
		</Tooltip>
	);
};

export const InfoPageItem: Component<{
	title: string;
	description?: string;
	value: string;
}> = (props) => {
	return (
		<div class="flex flex-col gap-1">
			<span class="font-semibold text-foreground">{props.title}</span>
			<Show when={props.description}>
				<small class="text-muted-foreground leading-3.5 mb-1">
					{props.description}
				</small>
			</Show>
			<div class="flex flex-row gap-1 items-center">
				<code>{props.value}</code>
				<CopyButton value={props.value} />
			</div>
		</div>
	);
};

export const SettingsInfoPage: Component<{
	uri: string;
}> = (props) => {
	const { did, collection, identifier } = AtURI.parseAtURI(props.uri);

	return (
		<SettingsPage loading={() => false} title="Debug Information">
			<div class="flex flex-col gap-4">
				<InfoPageItem title="Owner DID" value={did} />
				<InfoPageItem title="Collection" value={collection} />
				<InfoPageItem title="Identifier" value={identifier} />
				<InfoPageItem title="AT-URI" value={props.uri} />
				<a
					href={`https://atproto.at/uri/${props.uri}`}
					target="_blank"
					rel="noreferrer"
					class="font-normal hover:underline w-fit flex flex-row gap-2 items-center mt-4"
				>
					<span class="text-foreground">
						View on atproto.
						<span class="text-[#1185fe]">at://</span>
					</span>
				</a>
			</div>
		</SettingsPage>
	);
};

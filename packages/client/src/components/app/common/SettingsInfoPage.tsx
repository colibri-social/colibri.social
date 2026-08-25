import { type Component, createSignal, Match, Show, Switch } from "solid-js";
import CheckIcon from "~icons/ph/check";
import CopyIcon from "~icons/ph/copy";
import { describeAtURI } from "../../../utils/at-uri";
import { openExternalLink } from "../../../utils/open-external-link";
import { PDSls } from "../../icons/PDSls";
import { Button } from "../../ui/Button";
import { CopyButton } from "./CopyButton";
import { SettingsPage } from "./SettingsModal";

export const InfoPageItem: Component<{
	title: string;
	description?: string;
	value: string;
}> = (props) => {
	return (
		<div class="flex flex-col gap-1 w-full">
			<span class="font-semibold text-foreground">{props.title}</span>
			<Show when={props.description}>
				<small class="text-muted-foreground leading-3.5 mb-1">
					{props.description}
				</small>
			</Show>
			<div class="flex flex-row gap-1 items-center w-full wrap-break-word">
				<code class="w-[calc(100%-2rem)]">{props.value}</code>
				<CopyButton value={props.value} />
			</div>
		</div>
	);
};

export const InfoPageActions: Component<{ uri: string }> = (props) => {
	const [copied, setCopied] = createSignal(false);
	const isAtURI = () => props.uri.startsWith("at://");
	const pdslsHref = () => `https://pdsls.dev/${props.uri}`;

	const copyUri = () => {
		navigator.clipboard.writeText(props.uri);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div class="flex flex-row gap-2 items-center flex-wrap">
			<Show when={isAtURI()}>
				<Button
					onClick={copyUri}
					class="font-medium w-fit flex flex-row gap-2 items-center"
				>
					<Switch>
						<Match when={copied()}>
							<CheckIcon />
							<span>Copied!</span>
						</Match>
						<Match when={!copied()}>
							<CopyIcon />
							<span>Copy AT-URI</span>
						</Match>
					</Switch>
				</Button>
			</Show>
			<Show when={isAtURI() || props.uri.startsWith("did:")}>
				<Button
					as="a"
					variant="secondary"
					href={pdslsHref()}
					target="_blank"
					rel="noreferrer"
					onClick={(e) => openExternalLink(pdslsHref(), e)}
					class="font-medium w-fit flex flex-row gap-2 items-center"
				>
					<PDSls className="text-[#76C4E5]" size={16} />
					<span>View on PDSls</span>
				</Button>
			</Show>
		</div>
	);
};

export const SettingsInfoPage: Component<{
	uri: string;
}> = (props) => {
	const parts = () => describeAtURI(props.uri);

	return (
		<SettingsPage
			loading={() => false}
			title="Debug Information"
			contentClass="lg:max-w-none"
		>
			<div class="flex flex-col gap-4">
				<Show when={parts().spaceAuthority}>
					{(value) => <InfoPageItem title="Space Authority" value={value()} />}
				</Show>
				<Show when={parts().spaceType}>
					{(value) => <InfoPageItem title="Space Type" value={value()} />}
				</Show>
				<Show when={parts().spaceKey}>
					{(value) => <InfoPageItem title="Space Key" value={value()} />}
				</Show>
				<Show when={parts().did}>
					{(value) => <InfoPageItem title="Owner DID" value={value()} />}
				</Show>
				<Show when={parts().collection}>
					{(value) => <InfoPageItem title="Collection" value={value()} />}
				</Show>
				<Show when={parts().identifier}>
					{(value) => <InfoPageItem title="Identifier" value={value()} />}
				</Show>
				<InfoPageActions uri={props.uri} />
			</div>
		</SettingsPage>
	);
};

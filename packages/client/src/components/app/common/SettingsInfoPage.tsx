import { type Component, Show } from "solid-js";
import { AtURI } from "../../../utils/at-uri";
import { SettingsPage } from "./SettingsModal";
import { CopyButton } from "./CopyButton";

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

import type { Component } from "solid-js";
import { useUserContext } from "../../../contexts/User";
import { openExternalLink } from "../../../utils/open-external-link";
import { Button } from "../../ui/Button";
import { InfoPageItem } from "../common/SettingsInfoPage";
import { SettingsPage } from "../common/SettingsModal";

export const DebugPage: Component = () => {
	const user = useUserContext();
	const atUri = `at://${user.did}`;
	const atprotoAtHref = `https://atproto.at/uri/${atUri}`;
	return (
		<SettingsPage loading={() => false} title="Debug Information">
			<div class="flex flex-col gap-4">
				<InfoPageItem title="DID" value={user.did} />
				<InfoPageItem title="AT-URI" value={atUri} />
				<Button
					as="a"
					href={atprotoAtHref}
					target="_blank"
					rel="noreferrer"
					onClick={(e) => openExternalLink(atprotoAtHref, e)}
					class="font-medium w-fit flex flex-row gap-2 items-center bg-foreground hover:bg-foreground/90"
				>
					<span class="text-background">
						View on atproto.
						<span class="text-[#1185fe]">at://</span>
					</span>
				</Button>
			</div>
		</SettingsPage>
	);
};

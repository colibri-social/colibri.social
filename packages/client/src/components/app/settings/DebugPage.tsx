import type { Component } from "solid-js";
import { useUserContext } from "../../../contexts/User";
import { InfoPageItem } from "../common/SettingsInfoPage";
import { SettingsPage } from "../common/SettingsModal";

export const DebugPage: Component = () => {
	const user = useUserContext();
	const atUri = `at://${user.did}`;
	return (
		<SettingsPage loading={() => false} title="Debug Information">
			<div class="flex flex-col gap-4">
				<InfoPageItem title="DID" value={user.did} />
				<InfoPageItem title="AT-URI" value={atUri} />
				<a
					href={`https://atproto.at/uri/${atUri}`}
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

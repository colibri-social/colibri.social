import type { Component } from "solid-js";
import { useUserContext } from "../../../contexts/User";
import { InfoPageActions, InfoPageItem } from "../common/SettingsInfoPage";
import { SettingsPage } from "../common/SettingsModal";

export const DebugPage: Component = () => {
	const user = useUserContext();
	const atUri = `at://${user.did}`;

	return (
		<SettingsPage
			loading={() => false}
			title="Debug Information"
			contentClass="lg:max-w-none"
		>
			<div class="flex flex-col gap-4">
				<InfoPageItem title="DID" value={user.did} />
				<InfoPageActions uri={atUri} />
			</div>
		</SettingsPage>
	);
};

import { type Component, createSignal } from "solid-js";
import { DeleteAccountFlow } from "../account/DeleteAccountFlow";
import { SettingsPage } from "../common/SettingsModal";

export const AccountPage: Component = () => {
	const [loading, setLoading] = createSignal(false);

	return (
		<SettingsPage loading={loading} title="Delete account">
			<DeleteAccountFlow onLoadingChange={setLoading} />
		</SettingsPage>
	);
};

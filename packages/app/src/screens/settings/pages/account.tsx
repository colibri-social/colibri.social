import { AccountSettings } from "@colibri-social/ui";
import { createSignal } from "solid-js";
import { useAccountActions } from "../../../auth/account-actions";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import { StatusEditor } from "../../profile/status-editor";
import { ATMOSPHERE_ACCOUNT_URL, useSettingsNav } from "../nav";

export default function AccountPage(props: { platform: Platform }) {
	const data = useData();
	const nav = useSettingsNav();
	const account = useAccountActions();
	const [statusOpen, setStatusOpen] = createSignal(false);
	const status = () => data.presenceOf(data.viewer.did)?.status;
	return (
		<>
			<AccountSettings
				onEditProfile={() => nav.open("editProfile")}
				status={
					status()
						? [status()?.emoji, status()?.text].filter(Boolean).join(" ")
						: undefined
				}
				onEditStatus={() => setStatusOpen(true)}
				shareActivity={data.preferences.shareActivity()}
				onShareActivityChange={(share) =>
					void data.preferences.setShareActivity(share)
				}
				atmosphereAccountHref={ATMOSPHERE_ACCOUNT_URL}
				onLogOut={account ? () => void account.signOut() : undefined}
				onDeleteAccount={() => nav.open("deleteAccount")}
			/>
			<StatusEditor
				open={statusOpen()}
				onOpenChange={setStatusOpen}
				platform={props.platform}
			/>
		</>
	);
}

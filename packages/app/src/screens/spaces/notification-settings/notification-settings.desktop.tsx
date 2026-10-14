import { Modal, ModalContent } from "@colibri-social/ui";
import {
	NOTIFICATION_SETTINGS_COPY,
	notificationSettings,
} from "./notification-settings.contract";

export default notificationSettings.view({
	render: ({ slots: s, model: m }) => (
		<Modal open={m.args.open} onOpenChange={m.args.onOpenChange}>
			<ModalContent
				title={NOTIFICATION_SETTINGS_COPY.title}
				description={m.name()}
				class="md:w-[440px]"
			>
				<div data-space-notification-settings="" class="flex flex-col gap-4">
					<s.Level />
					<s.Mute />
				</div>
			</ModalContent>
		</Modal>
	),
});

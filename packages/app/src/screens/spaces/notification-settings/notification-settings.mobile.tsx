import { Drawer, DrawerContent } from "@colibri-social/ui";
import {
	NOTIFICATION_SETTINGS_COPY,
	notificationSettings,
} from "./notification-settings.contract";

export default notificationSettings.view({
	render: ({ slots: s, model: m }) => (
		<Drawer open={m.args.open} onOpenChange={m.args.onOpenChange}>
			<DrawerContent
				aria-label={NOTIFICATION_SETTINGS_COPY.title}
				header={
					<div class="flex min-w-0 flex-col items-center gap-0.5 text-center">
						<h2 class="m-0 truncate text-xl leading-tight font-bold text-foreground">
							{NOTIFICATION_SETTINGS_COPY.title}
						</h2>
						<span class="max-w-full truncate text-sm text-muted-foreground">
							{m.name()}
						</span>
					</div>
				}
			>
				<div data-space-notification-settings="" class="flex flex-col gap-4">
					<s.Settings />
				</div>
			</DrawerContent>
		</Drawer>
	),
});

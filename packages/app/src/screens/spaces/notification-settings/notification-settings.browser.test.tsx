import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { useData } from "../../../data/store";
import type { Did } from "../../../data/types";
import { cleanup, mountPage } from "../../settings/pages/page-test-kit";
import NotificationSettingsScreen from "./notification-settings.screen";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

afterEach(cleanup);

const Harness = () => {
	const data = useData();
	return (
		<NotificationSettingsScreen
			args={{
				space: data.communities.value()?.find((entry) => entry.did === HQ),
				open: true,
				onOpenChange: () => {},
			}}
		/>
	);
};

it("sets whether hidden messages show in one Space", async () => {
	const { store } = await mountPage(() => <Harness />);
	const group = page.getByRole("radiogroup", { name: "Hidden messages" });
	await expect
		.element(group.getByRole("radio", { name: /Follow my default/ }))
		.toBeChecked();
	await userEvent.click(group.getByText("Hide", { exact: true }));
	await expect.poll(() => store.preferences.spaceModeration(HQ)).toBe(true);
	expect(store.preferences.hidesModerated(HQ)).toBe(true);
	await userEvent.click(group.getByText("Follow my default"));
	await expect
		.poll(() => store.preferences.spaceModeration(HQ))
		.toBeUndefined();
});

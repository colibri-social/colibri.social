import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { SpaceRef } from "../../data/types";
import {
	HQ,
	main,
	mount,
	TEXT,
	until,
	wait,
} from "../../screens/channel/desktop-test-kit";
import { depthOf } from "../history-sync";

const BASE_PATH = `/app/c/${HQ}`;
const channelPath = (channel: string) => `${BASE_PATH}/${TEXT}/${channel}`;
const refOf = (channel: string) =>
	`at://${HQ}/space/${TEXT}/${channel}` as SpaceRef;

const sidebarButton = (name: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			"[data-channel-row] [data-channel-name]",
		),
	)
		.find((element) => element.textContent === name)
		?.closest("button") ?? undefined;

const activeChannel = () =>
	document.querySelector("[data-channel-row][data-active] [data-channel-name]")
		?.textContent;

const showing = (channel: string) => () =>
	location.pathname === channelPath(channel) && activeChannel() === channel;

const openFromSidebar = async (channel: string) => {
	await until(() => !!sidebarButton(channel));
	await userEvent.click(sidebarButton(channel) as HTMLElement);
	await until(showing(channel));
};

const channelLinkText = (channel: string) => `Head over to #${channel}`;

const postChannelLink = async (
	store: Awaited<ReturnType<typeof mount>>["store"],
	from: string,
	to: string,
) => {
	const text = channelLinkText(to);
	const start = text.indexOf("#");
	const feed = store.channel(refOf(from));
	await until(() => feed.ready());
	await feed.send({
		text,
		facets: [
			{
				index: { byteStart: start, byteEnd: text.length },
				features: [
					{ $type: "social.colibri.beta.richtext.facet#channel", channel: to },
				],
			},
		],
	});
};

const openFromLink = async (channel: string) => {
	const chip = () =>
		main().querySelector<HTMLElement>(`a[data-channel="${channel}"]`);
	const scroller = () =>
		main().querySelector<HTMLElement>("[data-message-list-scroller]");
	await until(() => {
		const element = scroller();
		if (element) element.scrollTop = element.scrollHeight;
		return !!chip();
	});
	await userEvent.click(chip() as HTMLElement);
	await until(showing(channel));
};

it("walks back and forward through channels opened from the sidebar", async () => {
	await mount(channelPath("general"));
	await openFromSidebar("dev");
	await openFromSidebar("design");
	const depth = depthOf(history.state);

	history.back();
	await until(showing("dev"));
	expect(depthOf(history.state)).toBe(depth);
	history.back();
	await until(showing("general"));
	history.forward();
	await until(showing("dev"));
	history.forward();
	await until(showing("design"));
});

it("walks back through channels opened from #-links", async () => {
	const { store } = await mount(channelPath("general"));
	await postChannelLink(store, "general", "dev");
	await postChannelLink(store, "dev", "design");
	await openFromLink("dev");
	await openFromLink("design");

	history.back();
	await until(showing("dev"));
	history.back();
	await until(showing("general"));
	history.forward();
	await until(showing("dev"));
});

it("stays on the Space entry after going back past the first channel", async () => {
	await mount(channelPath("general"));
	await userEvent.click(main());
	await until(() => depthOf(history.state) === 1);
	const length = history.length;

	history.back();
	await until(() => location.pathname === BASE_PATH);
	await wait(600);
	expect(location.pathname).toBe(BASE_PATH);
	expect(depthOf(history.state)).toBe(0);
	expect(history.length).toBe(length);

	history.forward();
	await until(showing("general"));
});

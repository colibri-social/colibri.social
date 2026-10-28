import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { DEV_PATH, until } from "../channel/desktop-test-kit";

const THREAD_PATH = `${DEV_PATH}/t/spring-tuning`;

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const TRIGGER = "Spring tuning, show members";

const threadHeader = (root: HTMLElement) =>
	Array.from(
		root.querySelectorAll<HTMLElement>('[data-channel-header="mobile"]'),
	).find((header) => !!buttonIn(header, TRIGGER));

const buttonIn = (scope: ParentNode | null | undefined, name: string) =>
	Array.from(scope?.querySelectorAll<HTMLElement>("button") ?? []).find(
		(button) => button.getAttribute("aria-label") === name,
	);

const mount = async () => {
	setLatency(0);
	history.replaceState(null, "", THREAD_PATH);
	const store = createDataStore(createMockSource({ live: false }));
	const root = document.createElement("div");
	host = root;
	root.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(root);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		root,
	);
	await until(() => !!threadHeader(root));
	return root;
};

it("opens the thread's members from the thread name and keeps the thread options", async () => {
	const root = await mount();
	const header = threadHeader(root);
	expect(buttonIn(header, "Thread options")).toBeDefined();
	buttonIn(header, TRIGGER)?.click();
	await until(() => location.pathname.endsWith("/dev/members"));
	await until(() => !!buttonIn(root, "Channel settings"));
});

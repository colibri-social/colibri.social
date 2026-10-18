import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import "../../app.css";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;

afterEach(async () => {
	stop?.();
	stop = undefined;
	document.body.innerHTML = "";
	await wait(50);
});

const mount = () => {
	setLatency(0);
	window.history.replaceState(null, "", "/app/profile/edit");
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return host;
};

const photo = async (name: string) => {
	const canvas = document.createElement("canvas");
	canvas.width = 1600;
	canvas.height = 900;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("no canvas");
	context.fillStyle = "#3b82f6";
	context.fillRect(0, 0, 1600, 900);
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (!blob) throw new Error("no blob");
	return new File([blob], name, { type: "image/png" });
};

const choose = (input: HTMLInputElement, file: File) => {
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const fileInputs = (host: HTMLElement) =>
	Array.from(host.querySelectorAll<HTMLInputElement>('input[type="file"]'));

const cropper = () =>
	document.querySelector<HTMLElement>("[data-full-screen-sheet]");

const buttonIn = (root: ParentNode, name: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("button")).filter(
		(element) =>
			(element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
			name,
	);

const decoded = async (src: string) => {
	const response = await fetch(src);
	const bitmap = await createImageBitmap(await response.blob());
	const size = [bitmap.width, bitmap.height];
	bitmap.close();
	return size;
};

describe("edit profile image cropping", () => {
	it("crops a new picture before it shows in the preview", async () => {
		const host = mount();
		await until(() => fileInputs(host).length === 2);
		const [, avatarInput] = fileInputs(host);
		if (!avatarInput) throw new Error("avatar input missing");
		const before = host
			.querySelector("img[data-profile-avatar-preview]")
			?.getAttribute("src");
		choose(avatarInput, await photo("sunset.png"));
		await until(
			() => !!cropper()?.querySelector("[data-image-crop-stage][data-ready]"),
		);
		await wait(400);
		const sheet = cropper() as HTMLElement;
		await expectNoLayoutIssues(sheet);
		expect(
			host
				.querySelector("img[data-profile-avatar-preview]")
				?.getAttribute("src"),
		).toBe(before);
		buttonIn(sheet, "Apply")[0]?.click();
		await until(() => !cropper());
		await until(
			() =>
				!!host
					.querySelector("img[data-profile-avatar-preview]")
					?.getAttribute("src")
					?.startsWith("blob:"),
		);
		const src = host
			.querySelector("img[data-profile-avatar-preview]")
			?.getAttribute("src") as string;
		expect(await decoded(src)).toEqual([512, 512]);
	});

	it("keeps the previous banner when cropping is cancelled", async () => {
		const host = mount();
		await until(() => fileInputs(host).length === 2);
		const [bannerInput] = fileInputs(host);
		if (!bannerInput) throw new Error("banner input missing");
		const before = host
			.querySelector("[data-profile-banner-preview]")
			?.getAttribute("src");
		choose(bannerInput, await photo("mountains.png"));
		await until(
			() => !!cropper()?.querySelector("[data-image-crop-stage][data-ready]"),
		);
		const sheet = cropper() as HTMLElement;
		const cancels = buttonIn(sheet, "Cancel");
		cancels[cancels.length - 1]?.click();
		await until(() => !cropper());
		expect(
			host.querySelector("[data-profile-banner-preview]")?.getAttribute("src"),
		).toBe(before);
	});
});

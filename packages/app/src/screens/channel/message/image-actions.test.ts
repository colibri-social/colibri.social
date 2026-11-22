import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@colibri-social/ui", () => ({ toast }));
vi.mock("../../../shell/desktop/window-chrome", () => ({
	isNativeShell: () => true,
}));

const { downloadMedia } = await import("./image-actions");

describe("downloadMedia in the native shell", () => {
	beforeEach(() => {
		invoke.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		vi.stubGlobal("location", { href: "https://colibri.social/app/" });
	});

	it("hands the link to the save_url command", async () => {
		invoke.mockResolvedValue({ name: "photo.png", type: "image/png" });

		await downloadMedia({
			src: "https://cdn.example.com/blob?id=1",
			name: "photo",
			mimeType: "image/png",
		});

		expect(invoke).toHaveBeenCalledWith("save_url", {
			url: "https://cdn.example.com/blob?id=1",
			name: "photo.png",
			type: "image/png",
		});
		expect(toast.success).toHaveBeenCalledWith("Saved photo.png");
	});

	it("resolves relative links against the page", async () => {
		invoke.mockResolvedValue({ name: "clip.mp4", type: "video/mp4" });

		await downloadMedia({ src: "/media/clip.mp4" });

		expect(invoke).toHaveBeenCalledWith("save_url", {
			url: "https://colibri.social/media/clip.mp4",
			name: "clip.mp4",
			type: undefined,
		});
	});

	it("names the photo library when the file went there", async () => {
		invoke.mockResolvedValue({
			name: "clip.mp4",
			type: "video/mp4",
			destination: "photos",
		});

		await downloadMedia({ src: "https://cdn.example.com/clip.mp4" });

		expect(toast.success).toHaveBeenCalledWith("Saved clip.mp4 to Photos");
	});

	it("stays quiet when the save dialog is closed", async () => {
		invoke.mockResolvedValue(null);

		await downloadMedia({ src: "https://cdn.example.com/a.png" });

		invoke.mockRejectedValue({ code: "Cancelled", message: "cancelled" });

		await downloadMedia({ src: "https://cdn.example.com/a.png" });

		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("points to Settings when photo access is off", async () => {
		invoke.mockRejectedValue({
			code: "PermissionDenied",
			message: "photo library access was denied",
		});

		await downloadMedia({
			src: "https://cdn.example.com/a.png",
			mimeType: "image/png",
		});

		expect(toast.error).toHaveBeenCalledWith(
			"Colibri can't save the image to your photos",
			{
				description:
					"Turn on photo access for Colibri in the Settings app, then try again.",
			},
		);
	});

	it("explains unsupported devices", async () => {
		invoke.mockRejectedValue({ code: "Unsupported", message: "no" });

		await downloadMedia({ src: "https://cdn.example.com/a.png" });

		expect(toast.error).toHaveBeenCalledWith(
			"Saving files doesn't work on this device yet",
		);
	});

	it("asks for another try when the save fails", async () => {
		invoke.mockRejectedValue({ code: "Failed", message: "status 500" });

		await downloadMedia({
			src: "https://cdn.example.com/a.mp3",
			mimeType: "audio/mpeg",
		});

		expect(toast.error).toHaveBeenCalledWith("Couldn't save the audio file", {
			description: "Give it another try.",
		});
	});
});

import { describe, expect, it } from "vitest";
import {
	IMAGE_UPLOAD_ACCEPT,
	imageRejectionCode,
	isUploadableImageType,
} from "./image-upload";

describe("isUploadableImageType", () => {
	it("accepts the types the AppView stores", () => {
		expect(isUploadableImageType("image/jpeg")).toBe(true);
		expect(isUploadableImageType("image/png")).toBe(true);
		expect(isUploadableImageType("image/gif")).toBe(true);
	});

	it("rejects webp, which the AppView refuses with a 400", () => {
		expect(isUploadableImageType("image/webp")).toBe(false);
	});

	it("rejects other media and missing types", () => {
		expect(isUploadableImageType("image/avif")).toBe(false);
		expect(isUploadableImageType("video/mp4")).toBe(false);
		expect(isUploadableImageType("")).toBe(false);
		expect(isUploadableImageType(undefined)).toBe(false);
	});

	it("ignores casing, which some platforms report differently", () => {
		expect(isUploadableImageType("IMAGE/PNG")).toBe(true);
	});
});

describe("IMAGE_UPLOAD_ACCEPT", () => {
	it("lists every uploadable type for the file picker", () => {
		expect(IMAGE_UPLOAD_ACCEPT).toBe("image/jpeg,image/png,image/gif");
	});
});

describe("imageRejectionCode", () => {
	it("passes an accepted image through", () => {
		expect(
			imageRejectionCode({
				acceptedFiles: [{ type: "image/png" }],
				rejectedFiles: [],
			}),
		).toBeUndefined();
	});

	it("reports nothing when no file was picked", () => {
		expect(imageRejectionCode(undefined)).toBeUndefined();
		expect(
			imageRejectionCode({ acceptedFiles: [], rejectedFiles: [] }),
		).toBeUndefined();
	});

	it("maps a type rejection from the picker", () => {
		expect(
			imageRejectionCode({
				acceptedFiles: [],
				rejectedFiles: [{ errors: ["FILE_INVALID_TYPE"] }],
			}),
		).toBe("UnsupportedFileType");
	});

	it("maps the other picker rejections", () => {
		expect(
			imageRejectionCode({
				acceptedFiles: [],
				rejectedFiles: [{ errors: ["FILE_TOO_LARGE"] }],
			}),
		).toBe("FileTooLarge");
		expect(
			imageRejectionCode({
				acceptedFiles: [],
				rejectedFiles: [{ errors: ["TOO_MANY_FILES"] }],
			}),
		).toBe("TooManyFiles");
	});

	it("catches a webp that the picker let through anyway", () => {
		expect(
			imageRejectionCode({
				acceptedFiles: [{ type: "image/webp" }],
				rejectedFiles: [],
			}),
		).toBe("UnsupportedFileType");
	});
});

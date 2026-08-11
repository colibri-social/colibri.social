import type { ColibriErrorCode } from "../errors/codes";
import { codeForFileRejection } from "../errors/copy";

export const UPLOADABLE_IMAGE_TYPES: ReadonlyArray<string> = [
	"image/jpeg",
	"image/png",
	"image/gif",
];

export const IMAGE_UPLOAD_ACCEPT = UPLOADABLE_IMAGE_TYPES.join(",");

export const isUploadableImageType = (type: string | undefined): boolean =>
	type !== undefined && UPLOADABLE_IMAGE_TYPES.includes(type.toLowerCase());

export type PickedImages = {
	acceptedFiles: ReadonlyArray<{ type: string }>;
	rejectedFiles: ReadonlyArray<{ errors: ReadonlyArray<string> }>;
};

export const imageRejectionCode = (
	picked: PickedImages | undefined,
): ColibriErrorCode | undefined => {
	if (picked === undefined) return undefined;

	const rejection = picked.rejectedFiles[0]?.errors[0];
	if (rejection !== undefined) return codeForFileRejection(rejection);

	return picked.acceptedFiles.some((file) => !isUploadableImageType(file.type))
		? "UnsupportedFileType"
		: undefined;
};

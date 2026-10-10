import {
	createMemo,
	createSignal,
	createUniqueId,
	type JSX,
	Show,
	splitProps,
} from "solid-js";
import { AnimatedAddIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { createLocalPreview } from "../../utils/local-preview";
import { createPress } from "../../utils/press";
import { createSlot } from "../../utils/slot";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { formatBytes } from "../Attachments/shared";

const DASH = 8;
const STROKE = 2;

export type ImageProblem = "type" | "size" | "unreadable";

export type ImageRejection = {
	reason: "type" | "size" | "type-and-size" | "unreadable";
	problems: ImageProblem[];
	file: File;
	message: string;
};

export type ImageUploadTileProps = {
	label: string;
	src?: string;
	animated?: boolean;
	accept?: string;
	maxBytes?: number;
	description?: JSX.Element;
	showDescription?: boolean;
	error?: string;
	shape?: "square" | "circle";
	size?: number;
	disabled?: boolean;
	onFileChange?: (file: File) => void;
	onReject?: (rejection: ImageRejection) => void;
	class?: string;
};

const FORMAT_LABELS: Record<string, string> = {
	"image/jpeg": "JPEG",
	"image/jpg": "JPEG",
	"image/png": "PNG",
	"image/gif": "GIF",
	"image/webp": "WebP",
	"image/avif": "AVIF",
	"image/svg+xml": "SVG",
	"image/heic": "HEIC",
	"image/heif": "HEIF",
	"image/bmp": "BMP",
	"image/tiff": "TIFF",
	"application/pdf": "PDF",
};

const acceptTokens = (accept: string) =>
	accept
		.split(",")
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);

const formatLabel = (token: string) => {
	if (token === "image/*") return undefined;
	if (token.startsWith(".")) return token.slice(1).toUpperCase();
	return FORMAT_LABELS[token] ?? token.split("/").at(-1)?.toUpperCase();
};

const joinList = (items: string[]) => {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
};

export const describeImageFormats = (accept = "image/*") => {
	const labels = acceptTokens(accept).map(formatLabel);
	if (labels.length === 0 || labels.some((label) => label === undefined))
		return "Any image";
	return joinList([...new Set(labels as string[])]);
};

export const formatSizeLimit = (bytes: number) =>
	formatBytes(bytes).replace(/\.0 /, " ");

export const describeImageLimits = (accept?: string, maxBytes?: number) => {
	const formats = describeImageFormats(accept);
	return maxBytes === undefined
		? formats
		: `${formats}, up to ${formatSizeLimit(maxBytes)}`;
};

export const acceptsFile = (accept: string, file: File) => {
	const type = file.type.toLowerCase();
	const name = file.name.toLowerCase();
	return acceptTokens(accept).some((token) => {
		if (token.startsWith(".")) return name.endsWith(token);
		if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
		if (token === "image/jpeg" || token === "image/jpg")
			return type === "image/jpeg" || type === "image/jpg";
		return type === token;
	});
};

const extensionOf = (name: string) => {
	const dot = name.lastIndexOf(".");
	return dot > 0 && dot < name.length - 1
		? name.slice(dot + 1).toUpperCase()
		: undefined;
};

export const detectedFormat = (file: File) => {
	const type = file.type.toLowerCase();
	return FORMAT_LABELS[type] ?? extensionOf(file.name);
};

export const checkImageFile = (
	file: File,
	accept = "image/*",
	maxBytes?: number,
): ImageRejection | undefined => {
	const wrongType = !acceptsFile(accept, file);
	const tooLarge = maxBytes !== undefined && file.size > maxBytes;
	if (!wrongType && !tooLarge) return undefined;

	const formats = describeImageFormats(accept);
	const anyImage = formats === "Any image";
	const detected = detectedFormat(file);
	const size = formatSizeLimit(file.size);
	const limit = maxBytes === undefined ? "" : formatSizeLimit(maxBytes);
	const unsupported = anyImage
		? "This file isn't an image"
		: detected
			? `${detected} isn't supported`
			: "This file type isn't supported";
	const use = anyImage ? "Choose an image file" : `Use ${formats}`;

	if (wrongType && tooLarge) {
		return {
			reason: "type-and-size",
			problems: ["type", "size"],
			file,
			message: `${unsupported} and the file is ${size}. ${use} under ${limit}.`,
		};
	}
	if (wrongType) {
		return {
			reason: "type",
			problems: ["type"],
			file,
			message: `${unsupported}. ${use}.`,
		};
	}
	return {
		reason: "size",
		problems: ["size"],
		file,
		message: `This image is ${size}. Choose one under ${limit}.`,
	};
};

export const canDecodeImage = (file: File) =>
	new Promise<boolean>((resolve) => {
		if (file.size === 0) {
			resolve(false);
			return;
		}
		if (typeof Image === "undefined" || typeof URL === "undefined") {
			resolve(true);
			return;
		}
		const url = URL.createObjectURL(file);
		const image = new Image();
		const done = (ok: boolean) => {
			URL.revokeObjectURL(url);
			resolve(ok);
		};
		image.onload = () =>
			done(image.naturalWidth > 0 && image.naturalHeight > 0);
		image.onerror = () => done(false);
		image.src = url;
	});

export const validateImageFile = async (
	file: File,
	accept = "image/*",
	maxBytes?: number,
): Promise<ImageRejection | undefined> => {
	const rejected = checkImageFile(file, accept, maxBytes);
	if (rejected) return rejected;
	if (await canDecodeImage(file)) return undefined;
	return {
		reason: "unreadable",
		problems: ["unreadable"],
		file,
		message: "This file couldn't be read as an image.",
	};
};

export const ImageUploadTile = (props: ImageUploadTileProps) => {
	const [local, rest] = splitProps(props, [
		"label",
		"src",
		"animated",
		"accept",
		"maxBytes",
		"description",
		"showDescription",
		"error",
		"shape",
		"size",
		"disabled",
		"onFileChange",
		"onReject",
		"class",
	]);
	const id = createUniqueId();
	const descriptionId = `${id}-description`;
	const errorId = `${id}-error`;
	const customDescription = createSlot(() => local.description);
	const [rejection, setRejection] = createSignal<string>();
	const preview = createLocalPreview(() => local.src);
	const error = () => local.error ?? rejection();
	const showDescription = () => local.showDescription !== false;
	let input: HTMLInputElement | undefined;
	const size = () => local.size ?? 96;
	const radius = () => (local.shape === "circle" ? size() / 2 : 16);
	const { pressed, pressProps } = createPress<HTMLButtonElement>({
		disabled: () => local.disabled,
	});

	const outline = createMemo(() => {
		const side = size() - STROKE;
		const corner = Math.max(0, radius() - STROKE / 2);
		const perimeter = 4 * (side - 2 * corner) + 2 * Math.PI * corner;
		const periods = Math.max(1, Math.round(perimeter / (DASH * 2)));
		return { side, corner, pathLength: periods * DASH * 2 };
	});

	let latestPick = 0;
	const onInputChange = async (
		event: Event & { currentTarget: HTMLInputElement },
	) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (!file) return;
		const attempt = ++latestPick;
		const rejected = await validateImageFile(
			file,
			local.accept,
			local.maxBytes,
		);
		if (attempt !== latestPick) return;
		if (rejected) {
			setRejection(rejected.message);
			local.onReject?.(rejected);
			return;
		}
		setRejection(undefined);
		preview.set(file);
		local.onFileChange?.(file);
	};

	const describedBy = () =>
		[showDescription() && descriptionId, error() && errorId]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<div
			data-image-upload=""
			data-invalid={error() ? "" : undefined}
			class={cx(
				"inline-flex max-w-full flex-col items-center gap-2 text-center",
				local.class,
			)}
		>
			<div
				class="relative inline-flex shrink-0"
				style={{ width: `${size()}px`, height: `${size()}px` }}
			>
				<button
					{...rest}
					{...pressProps}
					type="button"
					aria-label={local.label}
					aria-describedby={describedBy()}
					aria-invalid={error() ? true : undefined}
					disabled={local.disabled}
					data-icon-host=""
					data-pressed={pressed() || undefined}
					data-shape={local.shape ?? "square"}
					data-has-image={preview.src() ? "" : undefined}
					data-invalid={error() ? "" : undefined}
					onClick={() => input?.click()}
					class={cx(
						"group/upload pressable relative size-full cursor-pointer text-accent",
						"hover:text-muted-foreground",
						"data-invalid:text-destructive",
						"focus-ring",
						"disabled:cursor-not-allowed disabled:opacity-50",
					)}
					style={{ "border-radius": `${radius()}px` }}
				>
					<Show
						when={preview.src()}
						fallback={
							<svg
								aria-hidden="true"
								class="absolute inset-0 size-full"
								viewBox={`0 0 ${size()} ${size()}`}
								fill="none"
							>
								<rect
									x={STROKE / 2}
									y={STROKE / 2}
									width={outline().side}
									height={outline().side}
									rx={outline().corner}
									stroke="currentColor"
									stroke-width={STROKE}
									stroke-dasharray={`${DASH} ${DASH}`}
									pathLength={outline().pathLength}
								/>
							</svg>
						}
					>
						{(src) => (
							<AnimatedImage
								animated={preview.animated() ?? local.animated}
								src={src()}
								alt=""
								class="absolute inset-0 size-full object-cover"
								style={{ "border-radius": `${radius()}px` }}
							/>
						)}
					</Show>
					<span
						aria-hidden="true"
						data-upload-badge=""
						class={cx(
							"absolute flex size-6 items-center justify-center rounded-full bg-primary text-white",
							local.shape === "circle"
								? "top-0.5 right-0.5"
								: "-top-[5px] -right-1.5",
						)}
					>
						<AnimatedAddIcon trigger="press" size={16} />
					</span>
				</button>
				<input
					ref={input}
					type="file"
					accept={local.accept ?? "image/*"}
					tabIndex={-1}
					aria-hidden="true"
					class="hidden"
					disabled={local.disabled}
					onChange={onInputChange}
				/>
			</div>
			<Show when={showDescription()}>
				<p
					id={descriptionId}
					data-image-upload-description=""
					class="m-0 text-xs text-muted-foreground"
				>
					<Show
						when={customDescription.has()}
						fallback={describeImageLimits(local.accept, local.maxBytes)}
					>
						{customDescription()}
					</Show>
				</p>
			</Show>
			<Show when={error()}>
				{(message) => (
					<p
						id={errorId}
						role="alert"
						data-image-upload-error=""
						class="m-0 text-xs font-semibold text-destructive"
					>
						{message()}
					</p>
				)}
			</Show>
		</div>
	);
};

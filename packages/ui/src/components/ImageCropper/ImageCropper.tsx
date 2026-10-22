import { MagnifierZoomInIcon } from "@solar-icons/solid/bold/magnifier-zoom-in";
import { MagnifierZoomOutIcon } from "@solar-icons/solid/bold/magnifier-zoom-out";
import {
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { blockTouchScroll } from "../../utils/gestures/touch-scroll-block";
import { motionScale, prefersReducedMotion } from "../../utils/motion";
import { Button } from "../Button/Button";
import { FullScreenSheet } from "../FullScreenSheet/FullScreenSheet";
import { Modal, ModalContent } from "../Modal/Modal";
import { Slider } from "../Slider/Slider";
import { Spinner } from "../Spinner/Spinner";
import { TableText } from "../Table/TableText";
import {
	bandView,
	CROP_ASPECT,
	CROP_FALLBACK_TYPE,
	CROP_OUTPUT,
	type CropView,
	clampView,
	fitFrame,
	type ImageCropShape,
	MAX_ZOOM,
	MIN_ZOOM,
	type Size,
	sourceRect,
	zoomAround,
} from "./crop-math";
import { encodeCrop, loadWorkingBitmap } from "./encode-crop";

export type ImageCropperPlatform = "mobile" | "desktop";

export type ImageCropperProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file?: File;
	shape: ImageCropShape;
	platform?: ImageCropperPlatform;
	maxBytes?: number;
	onApply: (file: File) => void;
};

type StageApi = { crop: () => Promise<File> };

const FRAME_INSET = 16;

const CROP_SUBJECT: Record<ImageCropShape, string> = {
	avatar: "Picture",
	banner: "Banner",
	spaceBanner: "Banner",
	emoji: "Emoji",
};
const SETTLE_MS = 220;
const WHEEL_RATE = 0.0015;
const KEY_ZOOM = 1.1;
const KEY_PAN = 10;
const KEY_PAN_FAST = 40;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

const CropStage = (props: {
	file: File;
	shape: ImageCropShape;
	maxBytes?: number;
	class?: string;
	onReady: (api: StageApi | undefined) => void;
}) => {
	let stage: HTMLDivElement | undefined;
	let img: HTMLImageElement | undefined;
	let bitmap: ImageBitmap | undefined;
	let image: Size = { width: 1, height: 1 };
	let frame: Size = { width: 1, height: 1 };
	let view: CropView = { zoom: 1, x: 0, y: 0 };
	let settleFrame = 0;
	const pointers = new Map<number, { x: number; y: number }>();
	let gesture:
		| {
				base: CropView;
				start: Map<number, { x: number; y: number }>;
		  }
		| undefined;

	const [src, setSrc] = createSignal<string>();
	const [ready, setReady] = createSignal(false);
	const [failed, setFailed] = createSignal(false);
	const [frameSize, setFrameSize] = createSignal<Size>(frame);
	const [zoom, setZoom] = createSignal(1);

	const paint = () => {
		if (!img) return;
		const scale =
			Math.max(frame.width / image.width, frame.height / image.height) *
			view.zoom;
		img.style.width = `${image.width * scale}px`;
		img.style.height = `${image.height * scale}px`;
		img.style.transform = `translate3d(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px), 0)`;
		setZoom(view.zoom);
	};

	const setView = (next: CropView) => {
		view = next;
		paint();
	};

	const stopSettle = () => {
		if (settleFrame) cancelAnimationFrame(settleFrame);
		settleFrame = 0;
	};

	const settle = () => {
		stopSettle();
		const from = view;
		const to = clampView(view, image, frame);
		if (from.x === to.x && from.y === to.y && from.zoom === to.zoom) {
			return;
		}
		if (prefersReducedMotion()) {
			setView(to);
			return;
		}
		const duration = SETTLE_MS * motionScale();
		const started = performance.now();
		const step = (now: number) => {
			const t = duration > 0 ? Math.min(1, (now - started) / duration) : 1;
			const k = easeOut(t);
			setView({
				zoom: from.zoom + (to.zoom - from.zoom) * k,
				x: from.x + (to.x - from.x) * k,
				y: from.y + (to.y - from.y) * k,
			});
			settleFrame = t < 1 ? requestAnimationFrame(step) : 0;
		};
		settleFrame = requestAnimationFrame(step);
	};

	const pointFromCenter = (clientX: number, clientY: number) => {
		const box = stage?.getBoundingClientRect();
		if (!box) return { x: 0, y: 0 };
		return {
			x: clientX - (box.left + box.width / 2),
			y: clientY - (box.top + box.height / 2),
		};
	};

	const startGesture = () => {
		gesture = { base: view, start: new Map(pointers) };
	};

	const onPointerDown = (event: PointerEvent) => {
		if (!ready() || (event.pointerType === "mouse" && event.button !== 0)) {
			return;
		}
		stopSettle();
		try {
			stage?.setPointerCapture(event.pointerId);
		} catch {}
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		startGesture();
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!gesture || !pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		const ids = [...gesture.start.keys()].filter((id) => pointers.has(id));
		const [firstId, secondId] = ids;
		if (firstId === undefined) return;
		const a0 = gesture.start.get(firstId);
		const a1 = pointers.get(firstId);
		if (!a0 || !a1) return;
		if (secondId === undefined) {
			setView(
				bandView(
					{
						zoom: gesture.base.zoom,
						x: gesture.base.x + a1.x - a0.x,
						y: gesture.base.y + a1.y - a0.y,
					},
					image,
					frame,
				),
			);
			return;
		}
		const b0 = gesture.start.get(secondId);
		const b1 = pointers.get(secondId);
		if (!b0 || !b1) return;
		const startDistance = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
		const distance = Math.hypot(b1.x - a1.x, b1.y - a1.y);
		const startMid = pointFromCenter((a0.x + b0.x) / 2, (a0.y + b0.y) / 2);
		const mid = pointFromCenter((a1.x + b1.x) / 2, (a1.y + b1.y) / 2);
		const panned = {
			zoom: gesture.base.zoom,
			x: gesture.base.x + mid.x - startMid.x,
			y: gesture.base.y + mid.y - startMid.y,
		};
		setView(
			bandView(
				zoomAround(panned, gesture.base.zoom * (distance / startDistance), mid),
				image,
				frame,
			),
		);
	};

	const onPointerEnd = (event: PointerEvent) => {
		if (!pointers.delete(event.pointerId)) return;
		if (pointers.size > 0) {
			startGesture();
			return;
		}
		gesture = undefined;
		settle();
	};

	const onWheel = (event: WheelEvent) => {
		if (!ready()) return;
		event.preventDefault();
		stopSettle();
		const point = pointFromCenter(event.clientX, event.clientY);
		const next = zoomAround(
			view,
			view.zoom * Math.exp(-event.deltaY * WHEEL_RATE),
			point,
		);
		setView(clampView(next, image, frame));
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (!ready()) return;
		const pan = event.shiftKey ? KEY_PAN_FAST : KEY_PAN;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-pan, 0],
			ArrowRight: [pan, 0],
			ArrowUp: [0, -pan],
			ArrowDown: [0, pan],
		};
		const move = moves[event.key];
		let next: CropView | undefined;
		if (move) {
			next = { ...view, x: view.x + move[0], y: view.y + move[1] };
		} else if (event.key === "+" || event.key === "=") {
			next = zoomAround(view, view.zoom * KEY_ZOOM, { x: 0, y: 0 });
		} else if (event.key === "-" || event.key === "_") {
			next = zoomAround(view, view.zoom / KEY_ZOOM, { x: 0, y: 0 });
		}
		if (!next) return;
		event.preventDefault();
		stopSettle();
		setView(clampView(next, image, frame));
	};

	const setZoomLevel = (value: number) => {
		stopSettle();
		setView(clampView(zoomAround(view, value, { x: 0, y: 0 }), image, frame));
	};

	const measure = () => {
		if (!stage) return;
		const next = fitFrame(
			{ width: stage.clientWidth, height: stage.clientHeight },
			CROP_ASPECT[props.shape],
			FRAME_INSET,
		);
		const ratio = frame.width > 1 ? next.width / frame.width : 1;
		frame = next;
		setFrameSize(next);
		view = clampView(
			{ zoom: view.zoom, x: view.x * ratio, y: view.y * ratio },
			image,
			frame,
		);
		paint();
	};

	const crop = async () => {
		if (!bitmap) throw new Error("The image isn't ready");
		const settled = clampView(view, image, frame);
		return encodeCrop({
			bitmap,
			rect: sourceRect(settled, image, frame),
			output: CROP_OUTPUT[props.shape],
			name: props.file.name,
			maxBytes: props.maxBytes,
			fallbackType: CROP_FALLBACK_TYPE[props.shape],
		});
	};

	createEffect(
		on(
			() => props.file,
			(file) => {
				let cancelled = false;
				const url = URL.createObjectURL(file);
				setSrc(url);
				setReady(false);
				setFailed(false);
				props.onReady(undefined);
				view = { zoom: 1, x: 0, y: 0 };
				void loadWorkingBitmap(file).then(
					(loaded) => {
						if (cancelled) {
							loaded.close();
							return;
						}
						bitmap?.close();
						bitmap = loaded;
						image = { width: loaded.width, height: loaded.height };
						measure();
						setReady(true);
						props.onReady({ crop });
					},
					() => {
						if (!cancelled) setFailed(true);
					},
				);
				onCleanup(() => {
					cancelled = true;
					URL.revokeObjectURL(url);
				});
			},
		),
	);

	onCleanup(() => {
		stopSettle();
		bitmap?.close();
		bitmap = undefined;
		props.onReady(undefined);
	});

	const label = `${CROP_SUBJECT[props.shape]} crop area. Drag to move, pinch or scroll to zoom.`;

	return (
		<div class={cx("flex flex-col gap-4", props.class)}>
			<div
				ref={(element) => {
					stage = element;
					const observer = new ResizeObserver(measure);
					observer.observe(element);
					element.addEventListener("wheel", onWheel, { passive: false });
					const unblock = blockTouchScroll(element, () => pointers.size > 0);
					onCleanup(() => {
						observer.disconnect();
						element.removeEventListener("wheel", onWheel);
						unblock();
					});
				}}
				role="application"
				aria-roledescription="crop area"
				aria-label={label}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the crop area takes arrow keys to pan and plus or minus to zoom
				tabIndex={0}
				data-gesture="own"
				data-image-crop-stage=""
				data-layout-clip=""
				data-ready={ready() ? "" : undefined}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				onPointerCancel={onPointerEnd}
				onKeyDown={onKeyDown}
				class="focus-ring-inset relative h-[min(56dvh,420px)] w-full cursor-grab touch-none overflow-hidden rounded-surface bg-black outline-none select-none active:cursor-grabbing md:h-80"
			>
				<Show when={src()}>
					{(url) => (
						<img
							ref={img}
							src={url()}
							alt=""
							draggable={false}
							data-image-crop-image=""
							class={cx(
								"pointer-events-none absolute top-1/2 left-1/2 max-w-none",
								!ready() && "invisible",
							)}
						/>
					)}
				</Show>
				<div
					aria-hidden="true"
					data-image-crop-frame=""
					data-shape={props.shape}
					class={cx(
						"pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] ring-1 ring-white/60",
						props.shape === "avatar" ? "rounded-full" : "rounded-control",
					)}
					style={{
						width: `${frameSize().width}px`,
						height: `${frameSize().height}px`,
					}}
				/>
				<Show when={!ready() && !failed()}>
					<div class="absolute inset-0 flex items-center justify-center text-white/80">
						<Spinner class="size-6" />
					</div>
				</Show>
				<Show when={failed()}>
					<p
						role="alert"
						class="absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-sm text-white/80"
					>
						This image couldn't be opened.
					</p>
				</Show>
			</div>
			<div class="flex items-center gap-3 text-muted-foreground">
				<MagnifierZoomOutIcon aria-hidden="true" class="size-5 shrink-0" />
				<Slider
					aria-label="Zoom"
					class="min-w-0 flex-1"
					minValue={MIN_ZOOM}
					maxValue={MAX_ZOOM}
					step={0.01}
					value={[zoom()]}
					formatValue={(value) => `${Math.round(value * 100)}%`}
					disabled={!ready()}
					onChange={(values) => setZoomLevel(values[0] ?? 1)}
				/>
				<MagnifierZoomInIcon aria-hidden="true" class="size-5 shrink-0" />
			</div>
			<TableText
				data-image-crop-name=""
				class="text-center text-sm text-muted-foreground"
				text={props.file.name}
			/>
		</div>
	);
};

export const ImageCropper = (props: ImageCropperProps) => {
	const [api, setApi] = createSignal<StageApi>();
	const [applying, setApplying] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const title = () => `Crop ${CROP_SUBJECT[props.shape].toLowerCase()}`;

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (open) setError(undefined);
			},
		),
	);

	const apply = async () => {
		const current = api();
		if (!current || applying()) return;
		setApplying(true);
		setError(undefined);
		try {
			const file = await current.crop();
			props.onApply(file);
			props.onOpenChange(false);
		} catch {
			setError("The image couldn't be cropped. Try another one.");
		} finally {
			setApplying(false);
		}
	};

	const body = (): JSX.Element => (
		<>
			<Show when={props.file}>
				{(file) => (
					<CropStage
						file={file()}
						shape={props.shape}
						maxBytes={props.maxBytes}
						onReady={setApi}
					/>
				)}
			</Show>
			<Show when={error()}>
				<p role="alert" class="m-0 text-sm text-destructive">
					{error()}
				</p>
			</Show>
		</>
	);

	const actions = (block: boolean): JSX.Element => (
		<>
			<Button
				variant="secondary"
				block={block}
				disabled={applying()}
				onClick={() => props.onOpenChange(false)}
			>
				Cancel
			</Button>
			<Button
				block={block}
				loading={applying()}
				disabled={!api()}
				onClick={() => void apply()}
			>
				Apply
			</Button>
		</>
	);

	return (
		<Show
			when={props.platform === "desktop"}
			fallback={
				<FullScreenSheet
					open={props.open}
					onOpenChange={(open) => {
						if (!applying()) props.onOpenChange(open);
					}}
					title={title()}
					closeLabel="Cancel"
					footer={<div class="grid grid-cols-2 gap-2">{actions(true)}</div>}
				>
					{body()}
				</FullScreenSheet>
			}
		>
			<Modal
				open={props.open}
				onOpenChange={(open) => {
					if (!applying()) props.onOpenChange(open);
				}}
			>
				<ModalContent
					title={title()}
					class="md:w-[520px]"
					footer={actions(false)}
				>
					{body()}
				</ModalContent>
			</Modal>
		</Show>
	);
};

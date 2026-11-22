export type DefaultAvatarId =
	| "feather-quill"
	| "feather-iridescent"
	| "feather-pair"
	| "feather-fan"
	| "feather-falling";

export type DefaultAvatar = {
	id: DefaultAvatarId;
	label: string;
	background: string;
};

const VIEW_BOX = 1024;
const FEATHER_LEFT_VANE =
	"M0 -310C-55 -270 -100 -190 -108 -90L-34 -66L-112 -40C-116 40 -90 140 -10 230L0 230Z";
const FEATHER_RIGHT_VANE =
	"M0 -310C50 -270 92 -180 98 -60C104 50 80 150 8 230L0 230Z";
const FEATHER_DOWN =
	"M0 250C-30 262 -52 284 -60 312M0 270C26 280 44 300 50 326";

type FeatherOptions = {
	transform: string;
	ink: string;
	left?: string;
	right?: string;
	down?: boolean;
};

const feather = (options: FeatherOptions) => {
	const left = options.left ?? "#ffffff";
	const right = options.right ?? "#ece8f4";
	const down =
		options.down === false
			? ""
			: `<path d="${FEATHER_DOWN}" stroke="${right}" stroke-width="14" stroke-linecap="round" fill="none"/>`;
	return `<g transform="${options.transform}"><path d="${FEATHER_LEFT_VANE}" fill="${left}"/><path d="${FEATHER_RIGHT_VANE}" fill="${right}"/><path d="M0 -280V360" stroke="${options.ink}" stroke-width="16" stroke-linecap="round" fill="none"/>${down}</g>`;
};

const stroke = (d: string, color: string, width: number) =>
	`<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;

const definitions: Record<
	DefaultAvatarId,
	DefaultAvatar & { artwork: () => string }
> = {
	"feather-quill": {
		id: "feather-quill",
		label: "Feather, quill",
		background: "#8e51ff",
		artwork: () =>
			feather({
				transform: "translate(512 500) rotate(32) scale(1.05)",
				ink: "#4b2a99",
			}),
	},
	"feather-iridescent": {
		id: "feather-iridescent",
		label: "Feather, iridescent",
		background: "#1f1a2e",
		artwork: () =>
			feather({
				transform: "translate(512 500) rotate(-28) scale(1.05)",
				left: "#ae78ff",
				right: "#5cd6c0",
				ink: "#ffffff",
			}),
	},
	"feather-pair": {
		id: "feather-pair",
		label: "Feather, pair",
		background: "#f59e0b",
		artwork: () =>
			feather({
				transform: "translate(450 520) rotate(-22) scale(0.85)",
				ink: "#9a5b00",
				down: false,
			}) +
			feather({
				transform: "translate(590 520) rotate(26) scale(0.85)",
				right: "#fff4dc",
				ink: "#9a5b00",
				down: false,
			}),
	},
	"feather-fan": {
		id: "feather-fan",
		label: "Feather, fan",
		background: "#ef4444",
		artwork: () =>
			[-40, 0, 40]
				.map((angle) =>
					feather({
						transform: `translate(512 640) rotate(${angle}) translate(0 -230) scale(0.62)`,
						ink: "#8f1d1d",
						down: false,
					}),
				)
				.join(""),
	},
	"feather-falling": {
		id: "feather-falling",
		label: "Feather, falling",
		background: "#84cc16",
		artwork: () =>
			stroke(
				"M250 300C330 330 330 400 270 430M760 720C690 700 690 640 740 610",
				"#3f6212",
				22,
			) +
			feather({
				transform: "translate(512 512) rotate(70) scale(0.9)",
				ink: "#3f6212",
			}),
	},
};

export const DEFAULT_AVATAR_SET: readonly DefaultAvatarId[] = [
	"feather-quill",
	"feather-iridescent",
	"feather-pair",
	"feather-fan",
	"feather-falling",
];

export const defaultAvatar = (id: DefaultAvatarId): DefaultAvatar => {
	const { artwork: _artwork, ...meta } = definitions[id];
	return meta;
};

const hashString = (value: string) => {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
};

export const defaultAvatarFor = (
	seed: string,
	set: readonly DefaultAvatarId[] = DEFAULT_AVATAR_SET,
): DefaultAvatarId => {
	const pool = set.length > 0 ? set : DEFAULT_AVATAR_SET;
	return pool[hashString(seed) % pool.length];
};

export const defaultAvatarSvg = (id: DefaultAvatarId) => {
	const definition = definitions[id];
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}"><rect width="${VIEW_BOX}" height="${VIEW_BOX}" fill="${definition.background}"/>${definition.artwork()}</svg>`;
};

const urlCache = new Map<DefaultAvatarId, string>();

export const defaultAvatarUrl = (id: DefaultAvatarId) => {
	const cached = urlCache.get(id);
	if (cached) return cached;
	const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(defaultAvatarSvg(id))}`;
	urlCache.set(id, url);
	return url;
};

export const renderDefaultAvatar = (id: DefaultAvatarId, size = 512) =>
	new Promise<Blob>((resolve, reject) => {
		const image = new Image();
		image.decoding = "async";
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const context = canvas.getContext("2d");
			if (!context) {
				reject(new Error("Canvas is not available"));
				return;
			}
			context.drawImage(image, 0, 0, size, size);
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error("Could not encode the avatar"));
			}, "image/png");
		};
		image.onerror = () => reject(new Error("Could not draw the avatar"));
		image.src = defaultAvatarUrl(id);
	});

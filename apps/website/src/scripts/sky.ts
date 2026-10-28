const TAU = Math.PI * 2;
const TILE = 512;
const FRAME_MS = 33;

type Twinkle = {
	x: number;
	y: number;
	phase: number;
	speed: number;
	size: number;
	flare: boolean;
};

type CardStar = {
	x: number;
	y: number;
	base: number;
	r: number;
	glow: number;
	phase: number;
	speed: number;
	flare: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const makeGlowSprite = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 32;
	canvas.height = 32;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;
	const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
	grad.addColorStop(0, "rgba(255,255,255,1)");
	grad.addColorStop(0.18, "rgba(255,255,255,0.85)");
	grad.addColorStop(0.45, "rgba(214,206,255,0.25)");
	grad.addColorStop(1, "rgba(214,206,255,0)");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 32, 32);
	return canvas;
};

const findTileStars = (img: HTMLImageElement): Twinkle[] => {
	const canvas = document.createElement("canvas");
	canvas.width = TILE;
	canvas.height = TILE;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return [];
	ctx.drawImage(img, 0, 0, TILE, TILE);
	const data = ctx.getImageData(0, 0, TILE, TILE).data;
	const lum = (x: number, y: number) => {
		const i = (y * TILE + x) * 4;
		return (
			(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) *
			(data[i + 3] / 255)
		);
	};

	const found: Array<{ x: number; y: number; l: number }> = [];
	for (let y = 2; y < TILE - 2; y++) {
		for (let x = 2; x < TILE - 2; x++) {
			const l = lum(x, y);
			if (l < 150) continue;
			let peak = true;
			for (let dy = -2; dy <= 2 && peak; dy++) {
				for (let dx = -2; dx <= 2; dx++) {
					if ((dx || dy) && lum(x + dx, y + dy) > l) {
						peak = false;
						break;
					}
				}
			}
			if (peak) found.push({ x, y, l });
		}
	}

	found.sort((a, b) => b.l - a.l);
	return found
		.slice(0, 260)
		.filter(() => Math.random() < 0.42)
		.map((s) => ({
			x: s.x + 0.5,
			y: s.y + 0.5,
			phase: rand(0, TAU),
			speed: rand(1.2, 2.8),
			size: s.l > 220 ? rand(5, 8) : rand(3.5, 5.5),
			flare: s.l > 225 && Math.random() < 0.35,
		}));
};

const startLoop = (draw: (t: number) => void, isActive: () => boolean) => {
	let last = 0;
	const loop = (now: number) => {
		if (isActive() && now - last > FRAME_MS) {
			last = now;
			draw(now / 1000);
		}
		requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
};

export function initSkyTwinkle(tileSrc: string, reduceMotion: boolean) {
	const sky = document.querySelector<HTMLCanvasElement>("#sky");
	const ctx = sky?.getContext("2d");
	if (!sky || !ctx) return;

	const glow = makeGlowSprite();
	let twinkles: Twinkle[] = [];
	let width = 0;
	let height = 0;

	const resize = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = window.innerWidth;
		height = window.innerHeight;
		sky.width = Math.round(width * dpr);
		sky.height = Math.round(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	const draw = (t: number) => {
		ctx.clearRect(0, 0, width, height);
		const scrollY = window.scrollY;
		const top = Math.floor(scrollY / TILE);
		const rows = Math.ceil(height / TILE) + 1;
		const cols = Math.ceil(width / TILE);
		for (const s of twinkles) {
			const wave = Math.sin(t * s.speed + s.phase);
			if (wave <= 0.15) continue;
			const a = ((wave - 0.15) / 0.85) ** 3;
			const r = s.size * (0.7 + 0.3 * a);
			for (let ty = top; ty < top + rows; ty++) {
				const y = ty * TILE + s.y - scrollY;
				if (y < -10 || y > height + 10) continue;
				for (let tx = 0; tx <= cols; tx++) {
					const x = tx * TILE + s.x;
					if (x > width + 10) break;
					ctx.globalAlpha = a * 0.75;
					ctx.drawImage(glow, x - r, y - r, r * 2, r * 2);
					if (s.flare) {
						const len = r * 1.9;
						ctx.globalAlpha = a * 0.45;
						ctx.fillStyle = "#fff";
						ctx.fillRect(x - len, y - 0.35, len * 2, 0.7);
						ctx.fillRect(x - 0.35, y - len, 0.7, len * 2);
					}
				}
			}
		}
		ctx.globalAlpha = 1;
	};

	resize();
	window.addEventListener("resize", resize);

	const img = new Image();
	img.onload = () => {
		try {
			twinkles = findTileStars(img);
		} catch {
			twinkles = [];
		}
		if (reduceMotion) {
			draw(1.2);
			window.addEventListener("scroll", () => draw(1.2), { passive: true });
			return;
		}
		startLoop(draw, () => !document.hidden);
	};
	img.src = tileSrc;
}

export function initCardStars(
	canvas: HTMLCanvasElement,
	reduceMotion: boolean,
) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const glow = makeGlowSprite();
	let width = 0;
	let height = 0;
	let stars: CardStar[] = [];
	let visible = false;

	const build = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const count = Math.round((width * height) / 2600);
		stars = Array.from({ length: count }, () => {
			const bright = Math.random() < 0.12;
			return {
				x: Math.random() * width,
				y: Math.random() * height,
				base: rand(0.15, 0.45),
				r: bright ? rand(0.9, 1.4) : rand(0.4, 0.9),
				glow: bright ? rand(5, 8) : 0,
				phase: rand(0, TAU),
				speed: rand(0.4, 1.3),
				flare: bright && Math.random() < 0.5,
			};
		});
	};

	const draw = (t: number) => {
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = "#fff";
		for (const s of stars) {
			const wave = (Math.sin(t * s.speed + s.phase) + 1) / 2;
			ctx.globalAlpha = s.base + (1 - s.base) * wave ** 3;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.r, 0, TAU);
			ctx.fill();
			if (!s.glow) continue;
			const g = s.glow * (0.6 + 0.4 * wave);
			ctx.globalAlpha = wave ** 3 * 0.8;
			ctx.drawImage(glow, s.x - g, s.y - g, g * 2, g * 2);
			if (s.flare) {
				const len = g * 1.8;
				ctx.globalAlpha = wave ** 4 * 0.5;
				ctx.fillRect(s.x - len, s.y - 0.35, len * 2, 0.7);
				ctx.fillRect(s.x - 0.35, s.y - len, 0.7, len * 2);
			}
		}
		ctx.globalAlpha = 1;
	};

	build();
	new ResizeObserver(() => {
		build();
		draw(performance.now() / 1000);
	}).observe(canvas);

	if (reduceMotion) {
		draw(1);
		return;
	}

	new IntersectionObserver((entries) => {
		visible = entries[0]?.isIntersecting ?? false;
	}).observe(canvas);
	startLoop(draw, () => visible && !document.hidden);
}

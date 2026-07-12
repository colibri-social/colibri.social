import { Mesh, Plane, Program, Renderer, Texture } from "ogl";

type Side = "left" | "right";

interface Branch {
	side: Side;
	renderer: Renderer;
	mesh: Mesh;
	program: Program;
	canvas: HTMLCanvasElement;
	drawW: number;
	drawH: number;
	bendX: number;
	bendY: number;
	velX: number;
	velY: number;
	restX: number;
	seed: number;
	phase: number;
}

const K = 6;
const C = 2.2;
const FLUTTER = 0.006;
const GUST = 0.07;

const VERTEX = `
attribute vec3 position;
attribute vec2 uv;
uniform vec2 uBend;
uniform float uFlutter;
uniform float uTime;
uniform float uBaseSign;
uniform vec2 uScale;
varying vec2 vUv;
void main() {
	vec2 p = position.xy;
	float u = clamp(mix(p.x + 0.5, 0.5 - p.x, step(0.0, uBaseSign)), 0.0, 1.0);
	float u2 = u * u;
	float flutter = uFlutter * u * sin(uTime * 3.0 + p.y * 8.0);
	p += uBend * u2;
	p.y += flutter;
	gl_Position = vec4(p * uScale * 2.0, 0.0, 1.0);
	vUv = uv;
}
`;

const FRAGMENT = `
precision highp float;
uniform sampler2D uTex;
uniform float uFlip;
varying vec2 vUv;
void main() {
	vec2 uv = vUv;
	uv.x = mix(uv.x, 1.0 - uv.x, uFlip);
	vec4 c = texture2D(uTex, uv);
	if (c.a < 0.02) discard;
	gl_FragColor = vec4(c.rgb * c.a, c.a);
}
`;

function windX(t: number, b: Branch) {
	return (
		Math.sin(t * 0.6 + b.phase) * 0.035 +
		Math.sin(t * 1.7 + b.seed) * 0.015 +
		Math.sin(t * 0.27 + b.seed * 0.5) * 0.025
	);
}

function windY(t: number, b: Branch) {
	return (
		Math.sin(t * 0.5 + b.phase * 1.3) * 0.012 +
		Math.sin(t * 1.3 + b.seed * 0.7) * 0.008
	);
}

function resize(b: Branch) {
	const parent = b.canvas.parentElement;
	const w = parent?.clientWidth ?? 0;
	const h = parent?.clientHeight ?? 0;
	if (w < 2 || h < 2) return;
	b.renderer.setSize(w, h);
	b.program.uniforms.uScale.value = [
		Math.min(b.drawW / w, 1),
		Math.min(b.drawH / h, 1),
	];
}

function showFallback(canvas: HTMLCanvasElement) {
	const fallback =
		canvas.parentElement?.querySelector<HTMLElement>(".branch-fallback");
	if (fallback) fallback.style.display = "block";
	canvas.style.display = "none";
}

function createBranch(canvas: HTMLCanvasElement): Branch {
	const src = canvas.dataset.branchSrc;
	if (!src) throw new Error("missing branch src");
	const side = (canvas.dataset.branch as Side) ?? "right";
	const drawW = Number(canvas.dataset.drawW) || 800;
	const drawH = Number(canvas.dataset.drawH) || 519;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);

	const renderer = new Renderer({
		canvas,
		alpha: true,
		premultipliedAlpha: true,
		antialias: true,
		dpr,
	});
	const gl = renderer.gl;
	gl.clearColor(0, 0, 0, 0);

	const geometry = new Plane(gl, {
		width: 1,
		height: 1,
		widthSegments: 24,
		heightSegments: 16,
	});
	const texture = new Texture(gl, {
		generateMipmaps: false,
		flipY: true,
		premultiplyAlpha: false,
	});
	const program = new Program(gl, {
		vertex: VERTEX,
		fragment: FRAGMENT,
		transparent: true,
		cullFace: false,
		depthTest: false,
		depthWrite: false,
		uniforms: {
			uTex: { value: texture },
			uBend: { value: [0, 0] },
			uFlutter: { value: 0 },
			uTime: { value: 0 },
			uBaseSign: { value: side === "right" ? 1 : -1 },
			uFlip: { value: side === "left" ? 1 : 0 },
			uScale: { value: [1, 1] },
		},
	});
	const mesh = new Mesh(gl, { geometry, program });

	const branch: Branch = {
		side,
		renderer,
		mesh,
		program,
		canvas,
		drawW,
		drawH,
		bendX: 0,
		bendY: 0,
		velX: 0,
		velY: 0,
		restX: side === "right" ? -0.02 : 0.02,
		seed: side === "right" ? 11.3 : 47.9,
		phase: side === "right" ? 0 : 1.7,
	};

	const img = new Image();
	img.decoding = "async";
	img.onload = () => {
		texture.image = img;
		resize(branch);
		renderer.render({ scene: mesh });
		const fallback =
			canvas.parentElement?.querySelector<HTMLElement>(".branch-fallback");
		if (fallback) fallback.style.display = "none";
		canvas.style.display = "block";
	};
	img.src = src;

	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault();
		showFallback(canvas);
	});

	resize(branch);
	return branch;
}

export function initBranchWind() {
	const canvases = Array.from(
		document.querySelectorAll<HTMLCanvasElement>("canvas.branch-gl"),
	);
	if (!canvases.length) return null;

	const branches: Branch[] = [];
	for (const canvas of canvases) {
		try {
			branches.push(createBranch(canvas));
		} catch {
			showFallback(canvas);
		}
	}
	if (!branches.length) return null;

	for (const b of branches) {
		const ro = new ResizeObserver(() => resize(b));
		if (b.canvas.parentElement) ro.observe(b.canvas.parentElement);
	}

	let raf: number | null = null;
	let last = 0;
	let visible = true;

	function frame(t: number) {
		const now = t / 1000;
		const dt = Math.min(now - last, 0.032);
		last = now;
		for (const b of branches) {
			b.velX += (-K * (b.bendX - b.restX) - C * b.velX + windX(now, b)) * dt;
			b.velY += (-K * b.bendY - C * b.velY + windY(now, b)) * dt;
			b.bendX += b.velX * dt;
			b.bendY += b.velY * dt;
			const bend = b.program.uniforms.uBend.value as number[];
			bend[0] = b.bendX;
			bend[1] = b.bendY;
			b.program.uniforms.uFlutter.value = FLUTTER;
			b.program.uniforms.uTime.value = now;
			b.renderer.render({ scene: b.mesh });
		}
		raf = visible ? requestAnimationFrame(frame) : null;
	}

	function start() {
		if (raf == null) {
			last = performance.now() / 1000;
			raf = requestAnimationFrame(frame);
		}
	}

	const hero = document.querySelector(".hero");
	if (hero) {
		const io = new IntersectionObserver(
			(entries) => {
				visible = entries[0]?.isIntersecting ?? true;
				if (visible) start();
			},
			{ rootMargin: "120px" },
		);
		io.observe(hero);
	}

	start();

	function gust(side: Side, strength: number, dx: number, dy: number) {
		for (const b of branches) {
			if (b.side === side) {
				b.velX += GUST * strength * dx;
				b.velY += GUST * strength * dy;
			}
		}
		start();
	}

	if (import.meta.env.DEV) {
		(window as unknown as { __branchWind: unknown }).__branchWind = { gust };
	}

	return { gust };
}

interface Body {
	el: HTMLElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number;
	av: number;
	age: number;
	life: number;
	opacity: number;
	swayPhase: number;
	swayFreq: number;
}

interface FieldOpts {
	gravity: number;
	drag: number;
	windX: number;
	flutter: number;
	angDamp: number;
	repelR: number;
	repelA: number;
	spin: number;
	wrap: boolean;
	fade: boolean;
}

const TAU = Math.PI * 2;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const pointer = { cx: -1e5, cy: -1e5, vx: 0, vy: 0, t: 0 };
let pointerBound = false;
function ensurePointer() {
	if (pointerBound) return;
	pointerBound = true;
	window.addEventListener(
		"pointermove",
		(e) => {
			const now = performance.now();
			const dt = pointer.t ? Math.min((now - pointer.t) / 1000, 0.05) : 0;
			if (dt > 0) {
				pointer.vx = (e.clientX - pointer.cx) / dt;
				pointer.vy = (e.clientY - pointer.cy) / dt;
			}
			pointer.cx = e.clientX;
			pointer.cy = e.clientY;
			pointer.t = now;
		},
		{ passive: true },
	);
}

function makePetalNode(layer: HTMLElement): HTMLElement {
	const el = document.createElement("span");
	el.className = "phys-petal";
	el.innerHTML = '<svg viewBox="0 0 60 90"><use href="#petal-shape" /></svg>';
	layer.appendChild(el);
	return el;
}

function createField(layer: HTMLElement, opts: FieldOpts) {
	ensurePointer();
	const bodies: Body[] = [];
	let raf: number | null = null;
	let lastT = 0;
	let rect = layer.getBoundingClientRect();

	function step(t: number) {
		const dt = Math.min((t - lastT) / 1000, 0.032);
		lastT = t;
		rect = layer.getBoundingClientRect();
		const W = rect.width;
		const H = rect.height;
		const moving = performance.now() - pointer.t < 80;
		const px = pointer.cx - rect.left;
		const py = pointer.cy - rect.top;
		const pvx = moving ? pointer.vx : 0;
		const pvy = moving ? pointer.vy : 0;
		for (let i = bodies.length - 1; i >= 0; i--) {
			const p = bodies[i];
			const dx = p.x - px;
			const dy = p.y - py;
			const dist = Math.hypot(dx, dy) || 1e-4;
			if (dist < opts.repelR) {
				const f = 1 - dist / opts.repelR;
				const nx = dx / dist;
				const ny = dy / dist;
				p.vx += (nx * opts.repelA + pvx * 1.5) * f * dt;
				p.vy += (ny * opts.repelA + pvy * 1.5) * f * dt;
				p.av += Math.sign(pvx || nx) * opts.spin * f * dt;
			}
			p.vy += opts.gravity * dt;
			p.vx += opts.windX * dt;
			const d = Math.exp(-opts.drag * dt);
			p.vx *= d;
			p.vy *= d;
			p.swayPhase += p.swayFreq * dt;
			p.vx += Math.sin(p.swayPhase) * opts.flutter * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.angle += p.av * dt;
			p.av *= Math.exp(-opts.angDamp * dt);
			p.age += dt;

			if (opts.wrap) {
				const m = 40;
				if (p.y > H + m) p.y -= H + 2 * m;
				else if (p.y < -m) p.y += H + 2 * m;
				if (p.x > W + m) p.x -= W + 2 * m;
				else if (p.x < -m) p.x += W + 2 * m;
			} else if (p.age >= p.life || p.y > H + 60 || p.x < -60 || p.x > W + 60) {
				p.el.remove();
				bodies.splice(i, 1);
				continue;
			}

			p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.angle}deg)`;
			if (opts.fade) {
				const fade =
					p.age > p.life - 0.8 ? Math.max(0, (p.life - p.age) / 0.8) : 1;
				p.el.style.opacity = String(p.opacity * fade);
			}
		}
		raf = bodies.length > 0 ? requestAnimationFrame(step) : null;
	}

	function run() {
		if (raf == null) {
			lastT = performance.now();
			raf = requestAnimationFrame(step);
		}
	}

	return { bodies, run, rectOf: () => rect };
}

export function initHeroPetals() {
	const layer = document.querySelector<HTMLElement>(".hero-petals");
	if (!layer) return { burst: () => {} };
	const field = createField(layer, {
		gravity: 460,
		drag: 1.1,
		windX: 0,
		flutter: 55,
		angDamp: 0.8,
		repelR: 150,
		repelA: 1400,
		spin: 120,
		wrap: false,
		fade: true,
	});

	function burst(hitRect: DOMRect, count: number) {
		if (!layer) return;

		const rect = layer.getBoundingClientRect();
		const ox = hitRect.left - rect.left;
		const oy = hitRect.top - rect.top + 40;

		for (let i = 0; i < count; i++) {
			const el = makePetalNode(layer);
			const size = rand(9, 20);
			const blur = rand(0, 1);
			el.style.width = `${size}px`;
			el.style.height = `${size * 1.5}px`;
			if (blur > 0.1) el.style.filter = `blur(${blur}px)`;
			field.bodies.push({
				el,
				x: ox + Math.random() * hitRect.width,
				y: oy + Math.random() * hitRect.height,
				vx: rand(-70, 70),
				vy: rand(20, 130),
				angle: rand(0, 360),
				av: rand(-260, 260),
				age: 0,
				life: rand(4, 8),
				opacity: rand(0.18, 0.5),
				swayPhase: rand(0, TAU),
				swayFreq: rand(1.6, 3.4),
			});
		}
		field.run();
	}

	if (import.meta.env.DEV) {
		(window as unknown as { __heroPetals: () => number }).__heroPetals = () =>
			field.bodies.length;
	}

	return { burst };
}

export function initAmbientPetals() {
	const layer = document.querySelector<HTMLElement>(".petal-field");
	if (!layer) return;
	const nodes = layer.querySelectorAll<HTMLElement>(".petal");
	if (!nodes.length) return;
	const rect = layer.getBoundingClientRect();
	const field = createField(layer, {
		gravity: 30,
		drag: 0.6,
		windX: -35,
		flutter: 40,
		angDamp: 0.25,
		repelR: 150,
		repelA: 1400,
		spin: 120,
		wrap: true,
		fade: false,
	});

	for (const el of nodes) {
		const x = rand(0, rect.width);
		const y = rand(0, rect.height);
		const angle = rand(0, 360);
		el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
		field.bodies.push({
			el,
			x,
			y,
			vx: rand(-30, 10),
			vy: rand(10, 50),
			angle,
			av: rand(-30, 30),
			age: 0,
			life: Number.POSITIVE_INFINITY,
			opacity: 0,
			swayPhase: rand(0, TAU),
			swayFreq: rand(0.8, 1.8),
		});
	}
	field.run();
}

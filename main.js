import * as THREE from './vendor/three.module.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 899px)').matches;
gsap.registerPlugin(ScrollTrigger);

/* ---------- Smooth Scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.lenis = lenis;
  // Pin-Spacer verändert die Seitenhöhe: Lenis muss sein Limit neu messen
  ScrollTrigger.addEventListener('refresh', () => lenis.resize());
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = a.hash.length > 1 && document.querySelector(a.hash);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -68, duration: 1.4 });
    else target.scrollIntoView();
  });
});

/* ---------- Menü (mobil) ---------- */
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
burger.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') === 'true';
  burger.setAttribute('aria-expanded', String(!open));
  menu.hidden = open;
  document.body.style.overflow = open ? '' : 'hidden';
});
menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => burger.click()));

/* ---------- Renderer (Dunst + Partikel teilen sich ein Canvas) ---------- */
const prog = { hero: 0, pan: 0, glut: 0 };
const smooth = { hero: 0, pan: 0, glut: 0 };
let intro = 0;
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.autoClear = false;

/* ---------- Dunst: zwei Nebelschichten, halbe Auflösung, Maus- und Scroll-Parallax ---------- */
// Farben als rohe sRGB-Werte (keine Farbraum-Konvertierung durch THREE.Color)
const rgb = (hex) => new THREE.Vector3(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const fogLight = { a: rgb('#FFFEFA'), b: rgb('#D0B98D') };   // Creme-Weiß im Licht, Sand-Gold im Schatten
const fogDark = { a: rgb('#3D2F1D'), b: rgb('#1A140E') };    // Gold-Schimmer im Dunkeln, Espresso-Dunst
const fog = { lift: reduced ? 1 : 2.1, mix: 0 };
const fogScale = mobile ? 0.4 : 0.5;
const fogCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
const fogScene = new THREE.Scene();
const fogMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.NoBlending,
  uniforms: {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uDensity: { value: 0 },
    uAlpha: { value: 1 },
    uColA: { value: fogLight.a.clone() },
    uColB: { value: fogLight.b.clone() },
  },
  vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    precision highp float;
    #define OCT ${mobile ? 3 : 5}
    uniform float uTime, uScroll, uDensity, uAlpha;
    uniform vec2 uRes, uMouse;
    uniform vec3 uColA, uColB;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < OCT; i++) { v += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
      return v;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float asp = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * asp, uv.y);
      p += uMouse * vec2(0.06, 0.035);
      float t = uTime * 0.03;
      // Schicht 1: groß, langsam, fern (wenig Scroll-Parallax)
      vec2 p1 = p * 1.1 + vec2(t * 0.8, -uScroll * 0.18);
      vec2 q1 = vec2(fbm(p1), fbm(p1 + vec2(5.2, 1.3)));
      float f1 = fbm(p1 + q1 * 1.6 + vec2(-t * 0.4, t * 0.2));
      // Schicht 2: kleiner, schneller, nah (mehr Parallax)
      vec2 p2 = p * 2.3 + vec2(-t * 1.3, -uScroll * 0.45);
      vec2 q2 = vec2(fbm(p2 + vec2(1.7, 9.2)), fbm(p2 + vec2(8.3, 2.8)));
      float f2 = fbm(p2 + q2 * 1.2 + vec2(t * 0.3, 0.0));
      float c1 = smoothstep(0.36, 0.74, f1);
      float c2 = smoothstep(0.42, 0.80, f2);
      // unten dichter (Bodennebel), oben rechts eine Lichtquelle hinter dem Dunst
      float ground = mix(0.55, 1.0, 1.0 - uv.y);
      float glow = exp(-length((uv - vec2(0.8, 0.8)) * vec2(1.0, 1.3 / asp)) * 2.2);
      float d = clamp(c1 * 0.8 + c2 * 0.55, 0.0, 1.0);
      // Wolkenränder sandfarben und halbtransparent, Kerne hell (Licht im Nebel)
      float a = clamp(smoothstep(0.0, 0.55, d) * uDensity * ground + glow * 0.25 * uDensity, 0.0, 1.0);
      vec3 col = mix(uColB, uColA, smoothstep(0.12, 0.85, d + glow * 0.4));
      gl_FragColor = vec4(col, a * uAlpha);
    }
  `,
});
fogScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fogMat));
const fogRT = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false });
const blitScene = new THREE.Scene();
const blitMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false,
  uniforms: { uMap: { value: fogRT.texture } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `precision highp float; uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = texture2D(uMap, vUv); }`,
});
blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));
function sizeFog() {
  const w = Math.max(2, Math.round(innerWidth * fogScale));
  const h = Math.max(2, Math.round(innerHeight * fogScale));
  fogRT.setSize(w, h);
  fogMat.uniforms.uRes.value.set(w, h);
}
sizeFog();

/* ---------- Partikel: Zettel-Chaos -> Fluss -> Website-Raster ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 8;

const N = mobile ? 3200 : 8000;
const posA = new Float32Array(N * 3);
const posB = new Float32Array(N * 3);
const posC = new Float32Array(N * 3);
const posD = new Float32Array(N * 3);
const rnd = new Float32Array(N);

const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Punkt auf dem Umriss eines Rechtecks (0..1 entlang des Umfangs), plus innere Zeilen
function rectPoint(w, h, t, rows) {
  const per = 2 * (w + h);
  let d = t * (per + rows * w);
  if (d < w) return [d - w / 2, h / 2];
  d -= w;
  if (d < h) return [w / 2, h / 2 - d];
  d -= h;
  if (d < w) return [w / 2 - d, -h / 2];
  d -= w;
  if (d < h) return [-w / 2, -h / 2 + d];
  d -= h;
  const row = Math.floor(d / w);
  return [(d - row * w) - w / 2, h / 2 - (h * (row + 1)) / (rows + 1)];
}

// A: ~48 verstreute, gekippte Zettel im Raum
const sheets = mobile ? 26 : 48;
const sheetM = [];
for (let s = 0; s < sheets; s++) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(gauss() * 0.7, gauss() * 0.9, gauss() * 0.6));
  const p = new THREE.Vector3(gauss() * 1.5, gauss() * 0.9, gauss() * 1.0);
  m.compose(p, q, new THREE.Vector3(1, 1, 1));
  sheetM.push(m);
}

// C: Website-Wireframe (Nav, Hero-Block, Bild, drei Karten)
const wire = [
  { w: 6.4, h: 0.3, x: 0, y: 1.75, rows: 0, share: 0.12 },
  { w: 2.9, h: 1.3, x: -1.7, y: 0.65, rows: 3, share: 0.24 },
  { w: 2.9, h: 1.3, x: 1.7, y: 0.65, rows: 0, share: 0.18 },
  { w: 1.95, h: 1.0, x: -2.22, y: -0.95, rows: 2, share: 0.16 },
  { w: 1.95, h: 1.0, x: 0, y: -0.95, rows: 2, share: 0.15 },
  { w: 1.95, h: 1.0, x: 2.22, y: -0.95, rows: 2, share: 0.15 },
];
const wireCum = [];
wire.reduce((acc, w) => { wireCum.push(acc + w.share); return acc + w.share; }, 0);

const tmp = new THREE.Vector3();
for (let i = 0; i < N; i++) {
  rnd[i] = Math.random();
  // A: Zettel
  const s = i % sheets;
  const [ax, ay] = rectPoint(0.62, 0.8, Math.random(), 3);
  tmp.set(ax + gauss() * 0.006, ay + gauss() * 0.006, gauss() * 0.004).applyMatrix4(sheetM[s]);
  posA.set([tmp.x, tmp.y, tmp.z], i * 3);
  // B: Fluss (7 Bahnen, fließen nach rechts)
  const lane = i % 7;
  posB.set([Math.random() * 12 - 6, (lane - 3) * 0.34 + gauss() * 0.03, gauss() * 0.12], i * 3);
  // C: Wireframe
  const u = Math.random();
  let k = wireCum.findIndex((c) => u < c);
  if (k < 0) k = wire.length - 1;
  const w = wire[k];
  const [cx, cy] = rectPoint(w.w, w.h, Math.random(), w.rows);
  posC.set([w.x + cx + gauss() * 0.004, w.y + cy + gauss() * 0.004, gauss() * 0.01], i * 3);
  // D: Glut, weit im Raum verteilt, treibt langsam
  posD.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5], i * 3);
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
geo.setAttribute('aPosB', new THREE.BufferAttribute(posB, 3));
geo.setAttribute('aPosC', new THREE.BufferAttribute(posC, 3));
geo.setAttribute('aPosD', new THREE.BufferAttribute(posD, 3));
geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

const mat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
  uniforms: {
    uTime: { value: 0 },
    uP1: { value: 0 },
    uP2: { value: 0 },
    uP3: { value: 0 },
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color('#8f6f36') },
    uSize: { value: (mobile ? 1.35 : 1.5) * Math.min(devicePixelRatio, 2) },
  },
  vertexShader: `
    attribute vec3 aPosB;
    attribute vec3 aPosC;
    attribute vec3 aPosD;
    attribute float aRand;
    uniform float uTime, uP1, uP2, uP3, uSize;
    varying float vA;
    void main() {
      float e1 = smoothstep(0.0, 1.0, uP1);
      float e2 = smoothstep(0.0, 1.0, uP2);
      float e3 = smoothstep(0.0, 1.0, uP3);
      // Zettel: leichtes Treiben
      vec3 pA = position;
      pA.y += sin(uTime * 0.6 + aRand * 6.2831) * 0.03;
      pA.x += cos(uTime * 0.5 + aRand * 4.1) * 0.02;
      // Fluss: nach rechts, leichte Welle
      vec3 pB = aPosB;
      pB.x = mod(pB.x + uTime * (0.8 + aRand * 0.9) + 6.0, 12.0) - 6.0;
      pB.y += sin(pB.x * 0.8 + uTime * 1.2 + aRand) * 0.08;
      // Raster: steht, minimales Flimmern
      vec3 pC = aPosC;
      pC.y += sin(uTime * 2.0 + aRand * 9.0) * 0.003;
      // Glut: treibt langsam, einzelne Funken glimmen auf
      vec3 pD = aPosD;
      pD.x += sin(uTime * 0.15 + aRand * 6.2831) * 0.25;
      pD.y += cos(uTime * 0.11 + aRand * 4.0) * 0.2 + sin(uTime * 0.05 + aRand) * 0.1;
      vec3 p = mix(pA, pB, e1);
      p = mix(p, pC, e2);
      p = mix(p, pD, e3);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float big = step(0.965, aRand);
      float glimmer = 0.6 + 0.4 * sin(uTime * (0.8 + aRand * 1.5) + aRand * 20.0);
      gl_PointSize = uSize * (0.55 + aRand * 0.6 + big * 0.9 + e3 * big * 1.2) * (18.0 / -mv.z);
      vA = (0.45 + aRand * 0.4 + big * 0.15) * mix(1.0, glimmer, e3);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    uniform vec3 uColor;
    varying float vA;
    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      float a = smoothstep(0.5, 0.15, d);
      gl_FragColor = vec4(uColor, a * vA * uOpacity);
    }
  `,
});

const group = new THREE.Group();
group.add(new THREE.Points(geo, mat));
scene.add(group);

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
if (!mobile) {
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

// Position des Feldes: im Hero rechts oben (Desktop) bzw. oben (mobil), im Fluss oben, als Raster leicht über der Mitte
let heroX = 0, heroY = 0, flowY = 0, flowX = 0, gridY = 0;
const clock = new THREE.Clock();
const colA = new THREE.Vector3(), colB = new THREE.Vector3();
const dotLight = new THREE.Color('#8f6f36'), dotDark = new THREE.Color('#D9B978');
let baseZ = 8;
function frame() {
  const t = clock.getElapsedTime();
  for (const k of ['hero', 'pan', 'glut']) smooth[k] += (prog[k] - smooth[k]) * 0.12;
  mat.uniforms.uTime.value = t;
  mat.uniforms.uP1.value = smooth.hero;
  mat.uniforms.uP2.value = smooth.pan;
  mat.uniforms.uP3.value = smooth.glut;
  // Im Fluss-Zustand dezenter, damit die Problem-Headline lesbar bleibt; als Glut gedimmt
  const flowDim = 1 - 0.45 * smooth.hero * (1 - smooth.pan);
  mat.uniforms.uOpacity.value = intro * flowDim * (1 - 0.35 * smooth.glut);
  mat.uniforms.uColor.value.copy(dotLight).lerp(dotDark, fog.mix);

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  const chaos = 1 - smooth.hero;
  // Kamerafahrt: im Hero leicht kreisend, als Glut langsame Drehung mit Maus-Parallax
  group.rotation.y = (mouse.x * 0.28 + Math.sin(t * 0.12) * 0.12) * chaos + smooth.glut * (t * 0.02 + mouse.x * 0.08);
  group.rotation.x = (-mouse.y * 0.18) * chaos + smooth.glut * (-mouse.y * 0.06);
  const px = heroX + (flowX - heroX) * smooth.hero;
  const py = heroY + (flowY - heroY) * smooth.hero;
  const gx = px * (1 - smooth.pan), gy = py + (gridY - py) * smooth.pan;
  group.position.set(gx * (1 - smooth.glut), gy * (1 - smooth.glut), 0);
  const sc = 1 + 0.18 * chaos;
  group.scale.set(sc, sc, sc);
  camera.position.z = baseZ * (1 + 0.06 * smooth.hero - 0.04 * smooth.pan + 0.12 * smooth.glut);

  // Dunst: im Hero dicht, ab dem Problem-Kapitel leichter; Farben kippen mit dem Ton der Seite
  const fu = fogMat.uniforms;
  fu.uTime.value = reduced ? 40 : t;
  fu.uMouse.value.set(mouse.x, -mouse.y);
  fu.uScroll.value = (lenis ? lenis.scroll : window.scrollY) / innerHeight;
  fu.uDensity.value = (1.0 - 0.3 * smooth.hero) * fog.lift;
  colA.lerpVectors(fogLight.a, fogDark.a, fog.mix);
  colB.lerpVectors(fogLight.b, fogDark.b, fog.mix);
  fu.uColA.value.copy(colA);
  fu.uColB.value.copy(colB);
  fu.uAlpha.value = 1 - 0.2 * fog.mix;

  renderer.setRenderTarget(fogRT);
  renderer.clear();
  renderer.render(fogScene, fogCam);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(blitScene, fogCam);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// Feld füllt den Raum rechts vom Hero-Text (Desktop) bzw. oberhalb (mobil)
function layoutHero() {
  const visibleHeight = 7.2;
  baseZ = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(21)));
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  heroX = 0;
  heroY = visibleHeight * (mobile ? 0.16 : 0.1);
  flowX = 0;
  flowY = visibleHeight * 0.26;
  gridY = visibleHeight * (mobile ? 0.2 : 0.1);
}
layoutHero();
addEventListener('load', () => { layoutHero(); ScrollTrigger.refresh(); });
addEventListener('resize', () => {
  layoutHero();
  renderer.setSize(innerWidth, innerHeight);
  sizeFog();
});

/* ---------- Zeilen-Reveal: Wörter wrappen, nach Zeile gestaffelt einblenden, danach Markup zurücksetzen ---------- */
function splitWords(el) {
  const orig = el.innerHTML;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  const words = [...el.querySelectorAll('.w')];
  const group = () => {
    let top = null, line = -1;
    words.forEach((w) => { const t = w.offsetTop; if (t !== top) { top = t; line++; } w.dataset.line = line; });
  };
  group();
  return { words, group, restore: () => { el.innerHTML = orig; } };
}
const splitHeads = [];
if (!reduced) {
  gsap.utils.toArray('.reveal.display').forEach((el) => {
    el.classList.remove('reveal');
    const s = splitWords(el);
    gsap.set(s.words, { yPercent: 70, opacity: 0 });
    splitHeads.push({ el, s });
  });
}

/* ---------- Intro: Nebel lichtet sich, Hero-Zeilen steigen auf ---------- */
gsap.to({ v: 0 }, { v: 1, duration: 1.1, ease: 'power2.out', onUpdate() { intro = this.targets()[0].v; } });
if (!reduced) {
  gsap.to(fog, { lift: 1, duration: 2.6, ease: 'power2.out' });
  gsap.from('.hero__mark', { opacity: 0, scale: 0.94, duration: 1.8, ease: 'power3.out', delay: 0.2 });
  gsap.from('.hero__eyebrow', { opacity: 0, y: 14, duration: 1.0, ease: 'power3.out', delay: 1.1 });
  gsap.from('.hero__scroll', { opacity: 0, y: 10, duration: 1.0, ease: 'power3.out', delay: 1.7 });
  gsap.delayedCall(0.4, () => document.documentElement.classList.add('is-loaded'));
} else {
  // Ohne Motion: geordnetes Raster, statisch
  prog.hero = 1; prog.pan = 1;
  document.documentElement.classList.add('is-loaded');
  document.getElementById('nav').classList.add('is-solid');
}

/* ---------- Kapitel-Navigation + Nach-oben: Zustand, keine Motion, darum auch ohne Motion-Präferenz ---------- */
const chapEls = gsap.utils.toArray('[data-chapter]');
const chapLinks = gsap.utils.toArray('.chapters a');
chapEls.forEach((sec, i) => {
  const link = chapLinks[i];
  if (!link) return;
  const next = chapEls[i + 1];
  const bar = link.querySelector('.chapters__bar i');
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%',
    endTrigger: next || '.footer', end: next ? 'top 55%' : 'bottom bottom',
    onToggle: (st) => link.classList.toggle('is-active', st.isActive),
    onUpdate: (st) => { if (bar) gsap.set(bar, { scaleY: st.progress }); },
  });
});
if (chapEls.length) {
  ScrollTrigger.create({ trigger: chapEls[0], start: 'top 80%', endTrigger: '.footer', end: 'top 60%', toggleClass: { targets: '#chapters', className: 'is-on' } });
}
ScrollTrigger.create({ trigger: '#hero', start: 'bottom 70%', end: 'max', toggleClass: { targets: '#totop', className: 'is-on' } });

/* ---------- Scroll-Choreografie ---------- */
if (!reduced) {
  // Hero: Inhalt hebt sich und verblasst, während der Nebel dünner wird
  ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top', onUpdate: (st) => { prog.hero = st.progress; } });
  gsap.to('.hero__brand', { opacity: 0, scale: 1.14, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 30%', scrub: true } });
  gsap.to('.hero__scroll', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: '25% top', scrub: true } });
  // Nav: über der Szene transparent, sobald gescrollt wird gefüllt
  ScrollTrigger.create({ start: 'top -60', end: 'max', toggleClass: { targets: '#nav', className: 'is-solid' } });

  // Leistungen: Horizontal-Pan (Desktop), währenddessen Fluss -> Raster
  const track = document.querySelector('.pan__track');
  if (!mobile) {
    const dist = () => track.scrollWidth - innerWidth;
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#leistungen', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true,
        onUpdate: (st) => { prog.pan = st.progress; },
      },
    });
  } else {
    ScrollTrigger.create({ trigger: '#leistungen', start: 'top 60%', end: 'bottom 40%', onUpdate: (st) => { prog.pan = st.progress; } });
  }

  // Bildband: Partikel werden zur Glut, Ton kippt von Creme nach Espresso, Dunst folgt
  ScrollTrigger.create({ trigger: '.band', start: 'top 70%', end: 'bottom 30%', onUpdate: (st) => { prog.glut = st.progress; } });
  // Über einen warmen Sand-Ton, sonst läuft die Interpolation durch mattes Grau
  gsap.timeline({ scrollTrigger: { trigger: '.band', start: 'top 75%', end: 'bottom 60%', scrub: true } })
    .to(document.documentElement, { '--bg': '#C9B28C', '--bg-2': '#BBA27A', '--fg': '#1B1510', '--fg-2': '#4E4234', '--line': 'rgba(27, 21, 16, 0.18)', '--accent': '#7A5E2C', ease: 'none' })
    .to(document.documentElement, { '--bg': '#100C08', '--bg-2': '#1A1410', '--fg': '#F2EBDF', '--fg-2': '#A89C8C', '--line': 'rgba(242, 235, 223, 0.14)', '--accent': '#C9A86A', ease: 'none' })
    .to(fog, { mix: 1, ease: 'none' }, 0);

  // Headlines: Wort für Wort, Zeile für Zeile
  splitHeads.forEach(({ s, el }) => {
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(s.words, {
        yPercent: 0, opacity: 1, duration: 1.1, ease: 'power3.out',
        stagger: (i, target) => Number(target.dataset.line) * 0.1 + i * 0.012,
        onComplete: s.restore,
      }),
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { splitHeads.forEach(({ s }) => s.group()); layoutHero(); ScrollTrigger.refresh(); });

  // Reveals (Absätze, Listen, Zeilen)
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%', once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });

  // Marquee: läuft endlos, Tempo und Richtung folgen dem Scroll
  const mq = gsap.to('.marquee__track', { xPercent: -50, ease: 'none', duration: 36, repeat: -1 });
  ScrollTrigger.create({
    trigger: document.body, start: 0, end: 'max',
    onUpdate: (self) => {
      const v = self.getVelocity();
      gsap.to(mq, { timeScale: gsap.utils.clamp(-5, 5, 1 + v / 700), duration: 0.5, overwrite: true });
    },
  });

  // Bildband: öffnet sich, Bild wirkt tiefer als die Seite
  gsap.fromTo('.band__frame', { clipPath: 'inset(0 14%)', scale: 0.92 }, { clipPath: 'inset(0 0%)', scale: 1, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top 85%', end: 'top 15%', scrub: true } });
  gsap.fromTo('.band__frame img', { yPercent: -14 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Nav: weg beim Runterscrollen, zurück beim Hochscrollen
  const nav = document.getElementById('nav');
  ScrollTrigger.create({
    start: 'top -120', end: 'max',
    onUpdate: (self) => gsap.to(nav, { yPercent: self.direction === 1 ? -100 : 0, duration: 0.35, overwrite: true }),
  });
} else {
  document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutHero(); ScrollTrigger.refresh(); });
  // Ton-Wechsel auch ohne Motion: ab dem Bildband dunkel
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const r = document.documentElement.style;
      r.setProperty('--bg', '#100C08'); r.setProperty('--bg-2', '#1A1410'); r.setProperty('--fg', '#F2EBDF'); r.setProperty('--fg-2', '#A89C8C'); r.setProperty('--line', 'rgba(242, 235, 223, 0.14)'); r.setProperty('--accent', '#C9A86A');
      fog.mix = 1; prog.glut = 1;
    });
  }, { threshold: 0.2 });
  io.observe(document.querySelector('.band'));
}

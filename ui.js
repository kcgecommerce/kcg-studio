/* Gemeinsame UI-Schicht: Cursor (Punkt + Ring) und Pfeil-Links.
   Läuft auf allen Seiten mit Motion (index, anfragesystem, erstgespraech). */
(() => {
  // Mobiles Menü auf Unterseiten. Die Startseite (mit Canvas #gl) steuert ihr Menü in main.js selbst.
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if (burger && menu && !document.getElementById('gl')) {
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      menu.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); burger.focus(); } });
  }
  // Links mit data-open klappen das genannte <details> auf, bevor dorthin gesprungen wird
  document.querySelectorAll('a[data-open]').forEach((a) => a.addEventListener('click', () => {
    const d = document.getElementById(a.dataset.open);
    if (d) d.open = true;
  }));

  // Live-Demos in den Geräterahmen: Iframe in Originalbreite rendern und auf die Rahmenbreite skalieren
  const fit = (box) => {
    const w = Number(box.dataset.w), h = Number(box.dataset.h), f = box.querySelector('iframe');
    if (!w || !f || !box.clientWidth) return;
    f.style.width = w + 'px'; f.style.height = h + 'px';
    f.style.transform = 'scale(' + box.clientWidth / w + ')';
  };
  const lives = document.querySelectorAll('.pf__live');
  if (lives.length && 'ResizeObserver' in window) {
    const ro = new ResizeObserver((es) => es.forEach((e) => fit(e.target)));
    lives.forEach((b) => { fit(b); ro.observe(b); });
  }

  // Pfeil-Links: zweiter Pfeil für den Wander-Effekt bei Hover
  document.querySelectorAll('.arrow__i').forEach((wrap) => {
    const svg = wrap.querySelector('svg');
    if (svg && wrap.querySelectorAll('svg').length === 1) wrap.appendChild(svg.cloneNode(true));
  });

  const fine = matchMedia('(pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced || document.body.dataset.cursor === 'off') return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="cursor__ring"></span><span class="cursor__dot"></span>';
  document.body.appendChild(el);
  document.documentElement.classList.add('has-cursor');

  const dot = el.querySelector('.cursor__dot');
  const ring = el.querySelector('.cursor__ring');
  const pos = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
  let shown = false;

  addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    if (!shown) { shown = true; pos.rx = pos.x; pos.ry = pos.y; el.classList.add('is-on'); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { shown = false; el.classList.remove('is-on'); });

  const hot = 'a, button, summary, label, input, select, textarea, [data-cursor="hot"]';
  document.addEventListener('pointerover', (e) => {
    el.classList.toggle('is-hot', !!(e.target.closest && e.target.closest(hot)));
  });
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));

  // Ring folgt mit Verzögerung, Punkt sitzt direkt auf dem Zeiger
  (function loop() {
    pos.rx += (pos.x - pos.rx) * 0.16;
    pos.ry += (pos.y - pos.ry) * 0.16;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    ring.style.transform = `translate3d(${pos.rx}px, ${pos.ry}px, 0)`;
    requestAnimationFrame(loop);
  })();
})();

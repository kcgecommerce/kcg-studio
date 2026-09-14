/* Gemeinsame UI-Schicht: Cursor (Punkt + Ring) und Pfeil-Links.
   Läuft auf allen Seiten mit Motion (index, anfragesystem, erstgespraech). */
(() => {
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

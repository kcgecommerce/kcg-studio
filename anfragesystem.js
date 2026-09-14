/* Rechner und Mini-Funnel der Anfragesystem-Seite. Keine Abhängigkeiten. */
(function () {
  const eur = (n) => n.toLocaleString('de-DE') + ' €';

  /* ---------- Rechner ---------- */
  const wert = document.getElementById('calcWert');
  const anzahl = document.getElementById('calcAnzahl');
  const wertOut = document.getElementById('calcWertOut');
  const anzahlOut = document.getElementById('calcAnzahlOut');
  const jahr = document.getElementById('calcJahr');
  function calc() {
    const w = Number(wert.value), a = Number(anzahl.value);
    wertOut.textContent = eur(w);
    anzahlOut.textContent = String(a);
    jahr.textContent = eur(w * a * 12);
    // Füllstand der Regler als Gold-Spur
    for (const el of [wert, anzahl]) {
      const p = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty('--fill', p + '%');
    }
  }
  if (wert && anzahl) {
    wert.addEventListener('input', calc);
    anzahl.addEventListener('input', calc);
    calc();
  }

  /* ---------- Mini-Funnel ---------- */
  const form = document.getElementById('funnel-form');
  if (!form) return;
  const steps = Array.from(form.querySelectorAll('.funnel__step'));
  const bar = document.getElementById('funnelBar');
  const back = document.getElementById('funnelBack');
  const next = document.getElementById('funnelNext');
  const err = document.getElementById('funnelErr');
  const done = form.querySelector('.funnel__done');
  let i = 0;

  function show(n) {
    i = n;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    bar.style.width = ((i + 1) / steps.length) * 100 + '%';
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? 'Einschätzung anfordern' : 'Weiter';
    err.hidden = true;
    steps[i].querySelector('input')?.focus({ preventScroll: true });
  }

  function valid() {
    const s = steps[i];
    const inputs = Array.from(s.querySelectorAll('input'));
    if (inputs[0].type === 'checkbox' || inputs[0].type === 'radio') {
      if (!inputs.some((x) => x.checked)) return 'Bitte wähle mindestens eine Antwort.';
      return '';
    }
    for (const x of inputs) {
      if (x.required && !x.value.trim()) return 'Bitte fülle alle drei Felder aus, sonst können wir uns nicht melden.';
    }
    return '';
  }

  function collect() {
    const d = new FormData(form);
    return {
      kanal: d.getAll('kanal').join(', '),
      menge: d.get('menge') || '',
      tempo: d.get('tempo') || '',
      betrieb: d.get('betrieb') || '',
      name: d.get('name') || '',
      kontakt: d.get('kontakt') || '',
      seite: location.href,
      zeit: new Date().toISOString(),
    };
  }

  async function submit() {
    const data = collect();
    const hook = form.dataset.webhook;
    next.disabled = true;
    try {
      if (hook) {
        const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error('webhook ' + r.status);
      } else {
        // Ohne Webhook: E-Mail mit allen Antworten vorbereiten
        const body = [
          'Betrieb: ' + data.betrieb, 'Name: ' + data.name, 'Kontakt: ' + data.kontakt, '',
          'Anfragen kommen rein über: ' + data.kanal, 'Anfragen pro Monat: ' + data.menge, 'Antwortzeit heute: ' + data.tempo,
        ].join('\n');
        location.href = 'mailto:info@kcgstudio.de?subject=' + encodeURIComponent('Anfragesystem: ' + data.betrieb) + '&body=' + encodeURIComponent(body);
      }
      steps.forEach((s) => s.classList.remove('is-active'));
      form.querySelector('.funnel__nav').hidden = true;
      form.querySelector('.funnel__progress').hidden = true;
      done.hidden = false;
    } catch (e) {
      err.textContent = 'Das hat gerade nicht geklappt. Schreib uns direkt an info@kcgstudio.de.';
      err.hidden = false;
      next.disabled = false;
    }
  }

  next.addEventListener('click', () => {
    const msg = valid();
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    if (i < steps.length - 1) show(i + 1); else submit();
  });
  back.addEventListener('click', () => show(Math.max(0, i - 1)));
  form.addEventListener('submit', (e) => e.preventDefault());
  show(0);
})();

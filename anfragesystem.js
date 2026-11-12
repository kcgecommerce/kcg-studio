/* Rechner und Mini-Funnel der Anfragesystem-Seite. Keine Abhängigkeiten. */
(function () {
  const eur = (n) => n.toLocaleString('de-DE') + ' €';

  /* ---------- Rechner ---------- */
  const anfragen = document.getElementById('calcAnfragen');
  const minuten = document.getElementById('calcMinuten');
  const satz = document.getElementById('calcSatz');
  const stundenOut = document.getElementById('calcStunden');
  const wertOut = document.getElementById('calcWert');
  const wertLabel = document.getElementById('calcWertLabel');
  const toggles = Array.from(document.querySelectorAll('.calc__toggle button'));
  const komma1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let period = 'monat';

  function calc() {
    const a = Number(anfragen.value), m = Number(minuten.value), s = Number(satz.value);
    document.getElementById('calcAnfragenOut').textContent = String(a);
    document.getElementById('calcMinutenOut').textContent = m + ' Min.';
    document.getElementById('calcSatzOut').textContent = eur(s);
    const stundenJahr = (a * m / 60) * 52;
    const stunden = period === 'jahr' ? stundenJahr : stundenJahr / 12;
    // Der Zeitwert rechnet mit den ungerundeten Stunden, sonst weicht er von der angezeigten Formel ab
    stundenOut.textContent = (stunden >= 100 ? Math.round(stunden).toLocaleString('de-DE') : komma1.format(stunden)) + ' Std.';
    wertOut.textContent = eur(Math.round(stunden * s));
    wertLabel.textContent = 'rechnerischer Zeitwert pro ' + (period === 'jahr' ? 'Jahr' : 'Monat');
    // Füllstand der Regler als Gold-Spur
    for (const el of [anfragen, minuten, satz]) {
      const p = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty('--fill', p + '%');
    }
  }
  if (anfragen && minuten && satz) {
    for (const el of [anfragen, minuten, satz]) el.addEventListener('input', calc);
    for (const b of toggles) {
      b.addEventListener('click', () => {
        period = b.dataset.period;
        toggles.forEach((t) => {
          t.classList.toggle('is-active', t === b);
          t.setAttribute('aria-pressed', String(t === b));
        });
        calc();
      });
    }
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
      website: d.get('website') || '',
      seite: location.href,
      zeit: new Date().toISOString(),
    };
  }

  // 'ok' = angekommen, 'invalid' = n8n lehnt die Eingabe ab, 'down' = nicht erreichbar oder Versand gescheitert
  async function sendToWebhook(hook, data) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: ctrl.signal });
      if (r.ok) return 'ok';
      return r.status === 400 ? 'invalid' : 'down';
    } catch (e) {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }

  function openMail(data) {
    const body = [
      'Betrieb: ' + data.betrieb, 'Name: ' + data.name, 'Kontakt: ' + data.kontakt, '',
      'Anfragen kommen rein über: ' + data.kanal, 'Anfragen pro Monat: ' + data.menge, 'Antwortzeit heute: ' + data.tempo,
    ].join('\n');
    location.href = 'mailto:info@kcgstudio.de?subject=' + encodeURIComponent('Anfragesystem: ' + data.betrieb) + '&body=' + encodeURIComponent(body);
  }

  async function submit() {
    const data = collect();
    const hook = form.dataset.webhook;
    next.disabled = true;
    const result = hook ? await sendToWebhook(hook, data) : 'down';
    if (result === 'invalid') {
      err.textContent = 'Bitte prüfe deine Angaben, da stimmt etwas nicht.';
      err.hidden = false;
      next.disabled = false;
      return;
    }
    if (result === 'down') {
      // Ersatzweg: Die Anfrage ist erst raus, wenn der Besucher die Mail selbst abschickt. Das muss der Text auch so sagen.
      openMail(data);
      document.getElementById('funnelDoneH').textContent = 'Fast geschafft.';
      document.getElementById('funnelDoneP').innerHTML = 'Dein Mailprogramm hat sich mit deinen Antworten geöffnet. Bitte dort noch auf Senden drücken. Tut sich nichts, schreib uns an <a href="mailto:info@kcgstudio.de">info@kcgstudio.de</a> oder ruf an: <a href="tel:+491757724711">+49 175 7724711</a>.';
    }
    steps.forEach((s) => s.classList.remove('is-active'));
    form.querySelector('.funnel__nav').hidden = true;
    form.querySelector('.funnel__progress').hidden = true;
    done.hidden = false;
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

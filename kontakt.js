/* Kontaktformular der Startseite. Keine Abhängigkeiten. */
(function () {
  const form = document.getElementById('kontakt-form');
  if (!form) return;
  const send = document.getElementById('kformSend');
  const err = document.getElementById('kformErr');
  const done = document.getElementById('kformDone');

  function collect() {
    const d = new FormData(form);
    return {
      name: d.get('name') || '',
      betrieb: d.get('betrieb') || '',
      kontakt: d.get('kontakt') || '',
      nachricht: d.get('nachricht') || '',
      website: d.get('website') || '',
      seite: location.href,
      zeit: new Date().toISOString(),
    };
  }

  function valid(data) {
    for (const k of ['name', 'betrieb', 'kontakt']) {
      if (!data[k].trim()) return 'Bitte Name, Betrieb und Telefon oder E-Mail ausfüllen, sonst können wir uns nicht melden.';
    }
    return '';
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
    const body = ['Name: ' + data.name, 'Betrieb: ' + data.betrieb, 'Kontakt: ' + data.kontakt, '', 'Worum geht es:', data.nachricht].join('\n');
    location.href = 'mailto:info@kcgstudio.de?subject=' + encodeURIComponent('Erstgespräch: ' + data.betrieb) + '&body=' + encodeURIComponent(body);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collect();
    const msg = valid(data);
    if (msg) { err.textContent = msg; err.hidden = false; return; }
    err.hidden = true;
    send.disabled = true;
    const hook = form.dataset.webhook;
    const result = hook ? await sendToWebhook(hook, data) : 'down';
    if (result === 'invalid') {
      err.textContent = 'Bitte prüfe deine Angaben, da stimmt etwas nicht.';
      err.hidden = false;
      send.disabled = false;
      return;
    }
    if (result === 'down') {
      // Ersatzweg: Die Anfrage ist erst raus, wenn der Besucher die Mail selbst abschickt. Das muss der Text auch so sagen.
      openMail(data);
      document.getElementById('kformDoneH').textContent = 'Fast geschafft.';
      document.getElementById('kformDoneP').innerHTML = 'Dein Mailprogramm hat sich mit deinen Angaben geöffnet. Bitte dort noch auf Senden drücken. Tut sich nichts, ruf an: <a href="tel:+491757724711">+49 175 7724711</a>.';
    }
    form.querySelector('.kform__fields').hidden = true;
    form.querySelector('.kform__hint').hidden = true;
    form.querySelector('.kform__actions').hidden = true;
    done.hidden = false;
  });
})();

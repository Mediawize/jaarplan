// ============================================================
// rooster.js — Mijn rooster
// ============================================================

async function renderRooster() {
  showLoading('rooster');
  try {
    const klassen = await API.getKlassen();
    const userId  = Auth.currentUser?.id;
    const rooster = normaliseerRooster(await API.getRooster(userId));
    const dagen   = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'];
    const dagAfk  = { Maandag:'Ma', Dinsdag:'Di', Woensdag:'Wo', Donderdag:'Do', Vrijdag:'Vr' };
    const vandaag = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'][new Date().getDay()];

    document.getElementById('view-rooster').innerHTML = `
      <div class="rr-wrapper">
        <div class="page-header">
          <div class="page-header-left">
            <h1>Mijn rooster</h1>
            <p class="page-sub">Selecteer per klas en dag de lesuren waarop je les geeft</p>
          </div>
          <button class="btn btn-primary" id="rr-opslaan-btn" onclick="roosterOpslaan()">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style="margin-right:6px"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Opslaan
          </button>
        </div>

        <div class="rr-legenda">
          <div class="rr-legenda-blok">
            <div class="rr-legenda-titel">Leerjaar 1 &amp; 2</div>
            ${Object.entries(roosterTijdenVoorLeerjaar(1)).map(([u, t]) =>
              `<span class="rr-legenda-item"><strong>${u}</strong>${t[0]}</span>`
            ).join('')}
          </div>
          <div class="rr-legenda-blok">
            <div class="rr-legenda-titel">Leerjaar 3 &amp; 4</div>
            ${Object.entries(roosterTijdenVoorLeerjaar(3)).map(([u, t]) =>
              `<span class="rr-legenda-item"><strong>${u}</strong>${t[0]}</span>`
            ).join('')}
          </div>
        </div>

        <div class="rr-snelknoppen">
          <span class="rr-snelknoppen-label">Selecteer dag:</span>
          ${dagen.map(dag => `<button class="rr-snelknop" onclick="selecteerDag('${dag}')">${dagAfk[dag]}</button>`).join('')}
          <button class="rr-snelknop rr-snelknop--leeg" onclick="deselecteerAlles()">Alles leeg</button>
        </div>

        ${klassen.length === 0
          ? `<div class="empty-state"><p>Geen klassen gevonden. Voeg eerst klassen toe.</p></div>`
          : klassen.map(k => rrKlasKaart(k, dagen, dagAfk, rooster, vandaag)).join('')
        }

        <div class="rr-preview-sectie" id="rr-preview">
          ${rrPreviewHtml(klassen, rooster, vandaag)}
        </div>
      </div>
    `;
  } catch(e) {
    document.getElementById('view-rooster').innerHTML =
      `<div class="empty-state"><h3>Fout bij laden</h3><p>${escHtml(e.message)}</p></div>`;
  }
}

function rrKlasKaart(klas, dagen, dagAfk, rooster, vandaag) {
  const tijden  = roosterTijdenVoorLeerjaar(klas.leerjaar);
  const uren    = Object.keys(tijden).map(Number);
  const klasId  = klas.id;
  const totaalUren = dagen.reduce((s, dag) => s + ((rooster[klasId]?.[dag] || []).length), 0);

  const dagRijen = dagen.map(dag => {
    const gekozen = ((rooster[klasId] || {})[dag] || []).map(Number);
    const isVandaag = dag === vandaag;
    const tijdRange = rrTijdRange(gekozen, tijden);

    return `<div class="rr-dag-rij ${isVandaag ? 'rr-dag-rij--vandaag' : ''}">
      <div class="rr-dag-label">
        <span class="rr-dag-naam">${dagAfk[dag]}</span>
        ${isVandaag ? '<span class="rr-vandaag-dot"></span>' : ''}
      </div>
      <div class="rr-uren">
        ${uren.map(uur => `<label class="rr-pill ${gekozen.includes(uur) ? 'rr-pill--actief' : ''}" title="${dag} uur ${uur}: ${tijden[uur][0]}–${tijden[uur][1]}">
          <input type="checkbox"
            data-klas="${escHtml(klasId)}"
            data-dag="${escHtml(dag)}"
            data-uur="${uur}"
            ${gekozen.includes(uur) ? 'checked' : ''}
            onchange="roosterCheckChange(this)">
          <span>${uur}</span>
        </label>`).join('')}
      </div>
      <div class="rr-dag-info">
        ${gekozen.length
          ? `<span class="rr-dag-tijd">${tijdRange}</span><span class="rr-dag-uren">${gekozen.length}u</span>`
          : `<span class="rr-dag-leeg">—</span>`
        }
      </div>
    </div>`;
  }).join('');

  return `<div class="rr-klas-kaart">
    <div class="rr-klas-header">
      <div class="rr-klas-info">
        <div class="rr-klas-naam">${escHtml(klas.naam)}</div>
        <div class="rr-klas-sub">${escHtml(klas.niveau || '')}${klas.leerjaar ? ` · Leerjaar ${klas.leerjaar}` : ''}</div>
      </div>
      <div class="rr-klas-acties">
        ${totaalUren > 0 ? `<span class="rr-klas-totaal">${totaalUren} uren/week</span>` : ''}
        <button class="rr-klas-leeg-btn" onclick="leegmakenKlas('${escHtml(klasId)}')" title="Klas leegmaken">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <div class="rr-dag-lijst">${dagRijen}</div>
  </div>`;
}

function rrTijdRange(gekozen, tijden) {
  if (!gekozen.length) return '';
  const gesorteerd = [...gekozen].sort((a, b) => a - b);
  const start = tijden[gesorteerd[0]]?.[0] || '';
  const eind  = tijden[gesorteerd[gesorteerd.length - 1]]?.[1] || '';
  return `${start}–${eind}`;
}

function rrPreviewHtml(klassen, rooster, vandaag) {
  const items = klassen
    .map(k => ({ klas: k, uren: ((rooster[k.id]?.[vandaag]) || []).map(Number).sort((a,b)=>a-b) }))
    .filter(x => x.uren.length);

  if (!items.length) {
    return `<div class="rr-preview-leeg">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v2M14 2v2M2 8h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span>Geen lessen ingepland voor vandaag (${escHtml(vandaag)})</span>
    </div>`;
  }

  return `<div class="rr-preview-titel">Vandaag (${escHtml(vandaag)})</div>
    <div class="rr-preview-lijst">
      ${items.map(({ klas, uren }) => {
        const tijden = roosterTijdenVoorLeerjaar(klas.leerjaar);
        const range  = rrTijdRange(uren, tijden);
        return `<div class="rr-preview-chip">
          <div class="rr-preview-naam">${escHtml(klas.naam)}</div>
          <div class="rr-preview-meta">uur ${uren.join(', ')} · ${range}</div>
        </div>`;
      }).join('')}
    </div>`;
}

function roosterTijdenVoorLeerjaar(leerjaar) {
  const lj = parseInt(leerjaar, 10);
  const onderbouw = lj === 1 || lj === 2;
  return {
    1: ['08:30','09:15'],
    2: ['09:15','10:00'],
    3: ['10:20','11:05'],
    4: ['11:05','11:50'],
    5: onderbouw ? ['12:15','13:00'] : ['11:50','12:35'],
    6: ['13:00','13:45'],
    7: ['13:45','14:30'],
    8: ['14:45','15:30']
  };
}

function normaliseerRooster(rooster) {
  const output = {};
  Object.entries(rooster || {}).forEach(([klasId, waarde]) => {
    output[klasId] = {};
    if (Array.isArray(waarde)) {
      waarde.forEach(dag => { output[klasId][dag] = [1]; });
    } else if (waarde && typeof waarde === 'object') {
      Object.entries(waarde).forEach(([dag, uren]) => {
        output[klasId][dag] = Array.isArray(uren) ? uren.map(Number).filter(Boolean) : [];
      });
    }
  });
  return output;
}

function roosterCheckChange(checkbox) {
  const label = checkbox.closest('.rr-pill');
  if (label) label.classList.toggle('rr-pill--actief', checkbox.checked);
  _rrUpdateDagInfo(checkbox.dataset.klas, checkbox.dataset.dag);
  _rrUpdateKlasTotaal(checkbox.dataset.klas);
  _rrUpdatePreview();
}

function _rrUpdateDagInfo(klasId, dag) {
  const rij = document.querySelector(`.rr-dag-rij:has(input[data-klas="${CSS.escape(klasId)}"][data-dag="${dag}"])`);
  if (!rij) return;
  const gekozen = [...rij.querySelectorAll('input:checked')].map(cb => Number(cb.dataset.uur)).sort((a,b)=>a-b);
  const infoEl  = rij.querySelector('.rr-dag-info');
  if (!infoEl) return;
  const klas = (window._rrKlassen||[]).find(k => k.id === klasId);
  const tijden = roosterTijdenVoorLeerjaar(klas?.leerjaar || 3);
  infoEl.innerHTML = gekozen.length
    ? `<span class="rr-dag-tijd">${rrTijdRange(gekozen, tijden)}</span><span class="rr-dag-uren">${gekozen.length}u</span>`
    : `<span class="rr-dag-leeg">—</span>`;
}

function _rrUpdateKlasTotaal(klasId) {
  const kaart = document.querySelector(`.rr-klas-kaart:has(input[data-klas="${CSS.escape(klasId)}"])`);
  if (!kaart) return;
  const totaal = [...kaart.querySelectorAll('input:checked')].length;
  let totaalEl = kaart.querySelector('.rr-klas-totaal');
  if (totaal > 0) {
    if (!totaalEl) {
      const acties = kaart.querySelector('.rr-klas-acties');
      totaalEl = document.createElement('span');
      totaalEl.className = 'rr-klas-totaal';
      acties.insertBefore(totaalEl, acties.firstChild);
    }
    totaalEl.textContent = `${totaal} uren/week`;
  } else if (totaalEl) {
    totaalEl.remove();
  }
}

async function _rrUpdatePreview() {
  const previewEl = document.getElementById('rr-preview');
  if (!previewEl) return;
  try {
    const klassen = window._rrKlassen || await API.getKlassen();
    const rooster = haalHuidigRoosterOp(klassen);
    const vandaag = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'][new Date().getDay()];
    previewEl.innerHTML = rrPreviewHtml(klassen, rooster, vandaag);
  } catch(e) {}
}

function haalHuidigRoosterOp(klassen) {
  const rooster = {};
  klassen.forEach(k => {
    const perDag = {};
    ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'].forEach(dag => {
      const uren = [...document.querySelectorAll(`input[data-klas="${CSS.escape(k.id)}"][data-dag="${dag}"]:checked`)]
        .map(cb => Number(cb.dataset.uur)).sort((a, b) => a - b);
      if (uren.length) perDag[dag] = uren;
    });
    if (Object.keys(perDag).length) rooster[k.id] = perDag;
  });
  return rooster;
}

function selecteerDag(dag) {
  document.querySelectorAll(`input[data-dag="${dag}"]`).forEach(cb => {
    cb.checked = true;
    cb.closest('.rr-pill')?.classList.add('rr-pill--actief');
    _rrUpdateDagInfo(cb.dataset.klas, cb.dataset.dag);
  });
  document.querySelectorAll('.rr-klas-kaart').forEach(kaart => {
    const eersteKlas = kaart.querySelector('input[data-klas]')?.dataset.klas;
    if (eersteKlas) _rrUpdateKlasTotaal(eersteKlas);
  });
  _rrUpdatePreview();
}

function deselecteerAlles() {
  document.querySelectorAll('input[data-klas][data-uur]').forEach(cb => {
    cb.checked = false;
    cb.closest('.rr-pill')?.classList.remove('rr-pill--actief');
  });
  document.querySelectorAll('.rr-dag-info').forEach(el => {
    el.innerHTML = `<span class="rr-dag-leeg">—</span>`;
  });
  document.querySelectorAll('.rr-klas-totaal').forEach(el => el.remove());
  _rrUpdatePreview();
}

function leegmakenKlas(klasId) {
  document.querySelectorAll(`input[data-klas="${CSS.escape(klasId)}"]`).forEach(cb => {
    cb.checked = false;
    cb.closest('.rr-pill')?.classList.remove('rr-pill--actief');
  });
  ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'].forEach(dag => _rrUpdateDagInfo(klasId, dag));
  _rrUpdateKlasTotaal(klasId);
  _rrUpdatePreview();
}

async function roosterOpslaan() {
  const btn = document.getElementById('rr-opslaan-btn');
  try {
    const klassen = await API.getKlassen();
    window._rrKlassen = klassen;
    const rooster = haalHuidigRoosterOp(klassen);
    await API.saveRooster(Auth.currentUser.id, rooster);
    if (btn) {
      const origineel = btn.innerHTML;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" style="margin-right:6px"><path d="M4 10l5 5 7-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Opgeslagen!';
      btn.style.background = '#15803D';
      setTimeout(() => { btn.innerHTML = origineel; btn.style.background = ''; }, 2000);
    }
  } catch(e) { showError('Fout bij opslaan: ' + e.message); }
}

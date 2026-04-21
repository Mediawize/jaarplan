// ============================================================
// jaarplanning.js — Jaarplanning view met roulatie ondersteuning
// Inactieve roulatie-weken worden grijs weergegeven
// ============================================================

let _jpKlas = null;
let _jpWeken = [];
let _jpOpdrachten = [];
let _jpGebruikers = [];

async function renderJaarplanning() {
  showLoading('jaarplanning');
  try {
    const [klassen, vakken, gebruikers] = await Promise.all([API.getKlassen(), API.getVakken(), API.getGebruikers()]);
    _jpGebruikers = gebruikers;

    if (!klassen.length) {
      document.getElementById('view-jaarplanning').innerHTML = `
        <div class="empty-state"><h3>Geen klassen beschikbaar</h3><p>Maak eerst een klas aan.</p><button class="btn btn-primary" onclick="showView('klassen')">Naar klassen</button></div>`;
      return;
    }

    // Selecteer klas: uit window._selectedKlas of eerste
    let geselecteerdeKlas = klassen.find(k => k.id === window._selectedKlas) || klassen[0];
    _jpKlas = geselecteerdeKlas;

    const schooljaar = geselecteerdeKlas.schooljaar || klassen[0]?.schooljaar || '2025-2026';
    const [weken, opdrachten] = await Promise.all([
      API.getWeken(schooljaar),
      API.getOpdrachtenByKlas(geselecteerdeKlas.id)
    ]);
    _jpWeken = weken;
    _jpOpdrachten = opdrachten;

    const cw = getCurrentWeek();
    const vak = vakken.find(v => v.id === geselecteerdeKlas.vakId);
    const readonly = !Auth.canEdit();

    // Bereken roulatie statistieken
    const actieveWeken = weken.filter(w => !w.isVakantie && (!geselecteerdeKlas.roulatie || isRoulatieWeekActief(geselecteerdeKlas, w.weeknummer)));
    const inactieveWeken = geselecteerdeKlas.roulatie ? weken.filter(w => !w.isVakantie && !isRoulatieWeekActief(geselecteerdeKlas, w.weeknummer)) : [];

    document.getElementById('view-jaarplanning').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <div class="breadcrumb">Jaarplanning · ${escHtml(schooljaar)}</div>
          <h1>${escHtml(geselecteerdeKlas.naam)}
            ${geselecteerdeKlas.roulatie ? `<span style="font-size:13px;font-weight:600;padding:3px 10px;background:var(--amber-dim);color:var(--amber-text);border-radius:12px;margin-left:8px">⟳ Roulatie ${geselecteerdeKlas.roulatieBlok}w/blok</span>` : ''}
          </h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="jp-klas-select" onchange="jpSwitchKlas(this.value)" style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:#fff">
            ${klassen.map(k => `<option value="${k.id}" ${k.id === geselecteerdeKlas.id ? 'selected' : ''}>${escHtml(k.naam)}${k.roulatie?' ⟳':''}</option>`).join('')}
          </select>
          ${!readonly ? `<button class="btn btn-primary" onclick="openOpdrachtModal()">+ Opdracht</button>` : ''}
        </div>
      </div>

      ${geselecteerdeKlas.roulatie ? `
      <div style="background:var(--amber-dim);border:1px solid rgba(217,119,6,0.2);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:20px">⟳</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--amber-text)">Roulatieklas — ${geselecteerdeKlas.roulatieBlok} weken aan / ${geselecteerdeKlas.roulatieBlok} weken af · startweek ${geselecteerdeKlas.roulatieStart}</div>
          <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${actieveWeken.length} actieve weken · ${inactieveWeken.length} inactieve weken (grijs). Opdrachten kun je alleen in actieve weken plaatsen.</div>
        </div>
      </div>` : ''}

      <div class="jp-stats-row">
        <div class="jp-stat"><span class="jp-stat-val">${opdrachten.length}</span><span class="jp-stat-lbl">Opdrachten</span></div>
        <div class="jp-stat"><span class="jp-stat-val">${opdrachten.filter(o=>o.toetsBestand).length}</span><span class="jp-stat-lbl">Toetsen</span></div>
        <div class="jp-stat"><span class="jp-stat-val">${actieveWeken.length}</span><span class="jp-stat-lbl">Actieve weken</span></div>
        <div class="jp-stat"><span class="jp-stat-val">${geselecteerdeKlas.urenPerWeek||3}</span><span class="jp-stat-lbl">Uur/week</span></div>
      </div>

      <div id="jp-grid">
        ${renderJpGrid(weken, opdrachten, geselecteerdeKlas, cw, readonly)}
      </div>
    `;
  } catch(e) { showError('Fout bij laden: ' + e.message); }
}

function renderJpGrid(weken, opdrachten, klas, cw, readonly) {
  if (!weken.length) return `<div class="empty-state"><p>Geen weken gevonden voor dit schooljaar.</p></div>`;

  return weken.map(week => {
    const isVakantie = week.isVakantie || week.weektype === 'vakantie';
    const isHuidig = week.weeknummer === cw;

    // Roulatie check
    const isRoulatieInactief = klas.roulatie && !isVakantie && !isRoulatieWeekActief(klas, week.weeknummer);

    const weekOpd = opdrachten.filter(o => {
      if (!o.weken) return o.weeknummer === week.weeknummer;
      const [s, e] = String(o.weken).split('-').map(n => parseInt(n.trim()));
      return week.weeknummer >= s && week.weeknummer <= (e || s);
    });

    if (isVakantie) {
      return `<div class="jp-week jp-week-vakantie">
        <div class="jp-week-header">
          <span class="jp-week-nr">Wk ${week.weeknummer}</span>
          <span class="jp-week-datum">${week.van||''}</span>
          <span class="badge badge-amber" style="font-size:10px">${week.vakantieNaam||'Vakantie'}</span>
        </div>
      </div>`;
    }

    if (isRoulatieInactief) {
      return `<div class="jp-week jp-week-roulatie-inactief" style="opacity:0.38;background:var(--surface-2);border-color:var(--border)">
        <div class="jp-week-header" style="justify-content:space-between">
          <span class="jp-week-nr" style="color:var(--ink-3)">Wk ${week.weeknummer}</span>
          <span class="jp-week-datum" style="color:var(--ink-3)">${week.van||''}</span>
          <span style="font-size:10px;color:var(--ink-3);font-weight:500">⟳ Niet actief</span>
        </div>
        <div style="font-size:11px;color:var(--ink-3);padding:6px 0;font-style:italic">Klas is deze week bij een andere docent</div>
      </div>`;
    }

    return `<div class="jp-week ${isHuidig ? 'jp-week-huidig' : ''}">
      <div class="jp-week-header">
        <span class="jp-week-nr">${isHuidig ? '▶ ' : ''}Wk ${week.weeknummer}</span>
        <span class="jp-week-datum">${week.van||''}</span>
        ${!readonly ? `<button class="icon-btn" onclick="openOpdrachtModal(null, ${week.weeknummer})" title="Opdracht toevoegen" style="width:20px;height:20px;opacity:0.5">
          <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>` : ''}
      </div>
      ${week.thema ? `<div class="jp-week-thema">${escHtml(week.thema)}</div>` : ''}
      <div class="jp-opdrachten">
        ${weekOpd.length === 0
          ? `<div class="jp-leeg">Nog geen opdrachten</div>`
          : weekOpd.map(o => renderOpdrachtKaart(o, readonly)).join('')
        }
      </div>
    </div>`;
  }).join('');
}

function renderOpdrachtKaart(o, readonly) {
  const afgevinkt = !!o.afgevinkt;
  return `<div class="jp-opdracht ${afgevinkt ? 'jp-opdracht-afgevinkt' : ''}" data-id="${o.id}">
    <div class="jp-opdracht-top">
      <span class="badge ${typeKleur(o.type)}" style="font-size:10px">${escHtml(o.type)}</span>
      ${!readonly ? `<div style="display:flex;gap:4px">
        <button class="icon-btn" onclick="openOpdrachtModal('${o.id}')" style="width:18px;height:18px;opacity:0.5">
          <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="icon-btn" onclick="deleteOpdracht('${o.id}')" style="width:18px;height:18px;opacity:0.5;color:var(--red)">
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>` : ''}
    </div>
    <div class="jp-opdracht-naam ${afgevinkt ? 'line-through' : ''}">${escHtml(o.naam)}</div>
    ${o.beschrijving ? `<div class="jp-opdracht-desc">${escHtml(o.beschrijving.slice(0,80))}${o.beschrijving.length>80?'…':''}</div>` : ''}
    <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap">
      ${o.uren ? `<span style="font-size:11px;color:var(--ink-3)">${o.uren}u</span>` : ''}
      ${o.afgevinktDoor ? `<span style="font-size:10px;font-weight:700;font-family:monospace;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px">${escHtml(o.afgevinktDoor)}</span>` : ''}
      ${!readonly ? `<button onclick="jpAfvinken('${o.id}')" style="margin-left:auto;padding:2px 8px;font-size:11px;border-radius:5px;border:1.5px solid ${afgevinkt?'var(--accent)':'var(--border-2)'};background:${afgevinkt?'var(--accent-dim)':'#fff'};color:${afgevinkt?'var(--accent-text)':'var(--ink-3)'};cursor:pointer;font-weight:500">${afgevinkt?'✓ Klaar':'Afvinken'}</button>` : ''}
    </div>
  </div>`;
}

async function jpSwitchKlas(klasId) {
  window._selectedKlas = klasId;
  renderJaarplanning();
}

async function jpAfvinken(opdrachtId) {
  try {
    await API.afvinken(opdrachtId);
    Cache.invalidate('opdrachten');
    const [opdrachten] = await Promise.all([API.getOpdrachtenByKlas(_jpKlas.id)]);
    _jpOpdrachten = opdrachten;
    const cw = getCurrentWeek();
    document.getElementById('jp-grid').innerHTML = renderJpGrid(_jpWeken, _jpOpdrachten, _jpKlas, cw, !Auth.canEdit());
  } catch(e) { showError(e.message); }
}

// ============================================================
// Opdracht modal — met weekkeuze gefilterd op roulatie
// ============================================================
async function openOpdrachtModal(id = null, weeknr = null) {
  const [klassen, gebruikers, lesprofielen] = await Promise.all([API.getKlassen(), API.getGebruikers(), API.getLesprofielen()]);
  const o = id ? _jpOpdrachten.find(x => x.id === id) : null;
  const klas = _jpKlas;

  // Filter weken op: niet vakantie + roulatie actief
  const beschikbareWeken = _jpWeken.filter(w =>
    !w.isVakantie &&
    w.weektype !== 'vakantie' &&
    (!klas.roulatie || isRoulatieWeekActief(klas, w.weeknummer))
  );

  const wekenOpties = beschikbareWeken.map(w =>
    `<option value="${w.weeknummer}" ${(o?.weeknummer||weeknr)===w.weeknummer?'selected':''}>Week ${w.weeknummer}${w.van?` · ${w.van}`:''}</option>`
  ).join('');

  openModal(`
    <h2>${o ? 'Opdracht bewerken' : 'Nieuwe opdracht'}</h2>
    <p class="modal-sub">Klas: <strong>${escHtml(klas.naam)}</strong>${klas.roulatie ? ` <span style="color:var(--amber-text);font-size:12px">⟳ Roulatie — alleen actieve weken</span>` : ''}</p>
    <div class="form-grid">
      <div class="form-field" style="grid-column:1/-1"><label>Naam *</label><input id="opd-naam" placeholder="bijv. Hoofdstuk 3 — Magnetisme" value="${escHtml(o?.naam||'')}"></div>
      <div class="form-field" style="grid-column:1/-1"><label>Beschrijving</label><textarea id="opd-beschr" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;resize:vertical">${escHtml(o?.beschrijving||'')}</textarea></div>
      <div class="form-field"><label>Week *</label><select id="opd-week">${wekenOpties}</select></div>
      <div class="form-field"><label>Type</label><select id="opd-type">${['Theorie','Opdracht','Groepsopdracht','Toets','Eindtoets','Praktijk','Project','Presentatie','Overig'].map(t=>`<option value="${t}" ${(o?.type||'Opdracht')===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren</label><input id="opd-uren" type="number" step="0.5" min="0" placeholder="bijv. 2.5" value="${o?.uren||''}"></div>
      <div class="form-field"><label>Periode</label><select id="opd-periode">${[1,2,3,4].map(p=>`<option value="${p}" ${(o?.periode||1)===p?'selected':''}>Periode ${p}</option>`).join('')}</select></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveOpdracht('${id||''}')">Opslaan</button>
    </div>
  `);
}

async function saveOpdracht(id) {
  const naam = document.getElementById('opd-naam').value.trim();
  const weeknummer = parseInt(document.getElementById('opd-week').value);
  if (!naam) { alert('Naam is verplicht'); return; }

  const data = {
    klasId: _jpKlas.id,
    naam,
    beschrijving: document.getElementById('opd-beschr').value.trim() || null,
    weeknummer,
    weken: String(weeknummer),
    schooljaar: _jpKlas.schooljaar,
    type: document.getElementById('opd-type').value,
    uren: parseFloat(document.getElementById('opd-uren').value) || null,
    periode: parseInt(document.getElementById('opd-periode').value),
  };

  try {
    if (id) { await API.updateOpdracht(id, data); } else { await API.addOpdracht(data); }
    Cache.invalidate('opdrachten');
    closeModalDirect();
    const opdrachten = await API.getOpdrachtenByKlas(_jpKlas.id);
    _jpOpdrachten = opdrachten;
    const cw = getCurrentWeek();
    document.getElementById('jp-grid').innerHTML = renderJpGrid(_jpWeken, _jpOpdrachten, _jpKlas, cw, !Auth.canEdit());
  } catch(e) { showError(e.message); }
}

async function deleteOpdracht(id) {
  if (!confirm('Opdracht verwijderen?')) return;
  try {
    await API.deleteOpdracht(id);
    Cache.invalidate('opdrachten');
    _jpOpdrachten = _jpOpdrachten.filter(o => o.id !== id);
    const cw = getCurrentWeek();
    document.getElementById('jp-grid').innerHTML = renderJpGrid(_jpWeken, _jpOpdrachten, _jpKlas, cw, !Auth.canEdit());
  } catch(e) { showError(e.message); }
}

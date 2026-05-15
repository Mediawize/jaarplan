// ============================================================
// jaarplanning.js — Jaarplanning met volledige functionaliteit
// + roulatie ondersteuning (inactieve weken grijs)
// FIXES:
//  - renderJpGrid weekfilter robuuster gemaakt (Number/parseInt/trim)
//  - opdrachtkaart weeknummer-vergelijking type-safe
// ============================================================

let _jpKlas = null;
let _jpWeken = [];
let _jpOpdrachten = [];
let _jpGebruikers = [];

let _jpVakken = [];

function jpVakCodeVoorKlas(klas) {
  const vak = _jpVakken.find(v => v.id === klas?.vakId);
  const raw = String(vak?.naam || vak?.code || vak?.volledig || 'PIE').trim().toUpperCase();
  const match = raw.match(/[A-Z]{2,5}/);
  return match ? match[0] : 'PIE';
}

function jpFormatSyllabusCode(value, klas = _jpKlas) {
  if (!value) return '';
  const vakCode = jpVakCodeVoorKlas(klas);
  return String(value)
    .replace(/P\/\[A-Z\]\+\//gi, `P/${vakCode}/`)
    .replace(/P\/[A-Z]{2,5}\//gi, `P/${vakCode}/`);
}


async function renderJaarplanning() {
  showLoading('jaarplanning');
  try {
    const [klassen, vakken, gebruikers] = await Promise.all([API.getKlassen(), API.getVakken(), API.getGebruikers()]);
    _jpGebruikers = gebruikers;
    _jpVakken = vakken;

    if (!klassen.length) {
      document.getElementById('view-jaarplanning').innerHTML = `
        <div class="empty-state"><h3>Geen klassen beschikbaar</h3><p>Maak eerst een klas aan.</p><button class="btn btn-primary" onclick="showView('klassen')">Naar klassen</button></div>`;
      return;
    }

    let geselecteerdeKlas = klassen.find(k => k.id === window._selectedKlas) || klassen[0];
    _jpKlas = geselecteerdeKlas;

    const schooljaar = geselecteerdeKlas.schooljaar || '2025-2026';
    const [weken, opdrachten] = await Promise.all([
      API.getWeken(schooljaar),
      API.getOpdrachtenByKlas(geselecteerdeKlas.id)
    ]);
    _jpWeken = weken;
    _jpOpdrachten = opdrachten;

    const cw = getCurrentWeek();
    const vak = vakken.find(v => v.id === geselecteerdeKlas.vakId);
    const readonly = !Auth.canEdit();

    const actieveWeken = weken.filter(w => !w.isVakantie && (!geselecteerdeKlas.roulatie || isRoulatieWeekActief(geselecteerdeKlas, w.weeknummer)));
    const inactieveWeken = geselecteerdeKlas.roulatie ? weken.filter(w => !w.isVakantie && !isRoulatieWeekActief(geselecteerdeKlas, w.weeknummer)) : [];

    document.getElementById('view-jaarplanning').innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <div class="breadcrumb">Jaarplanning · ${escHtml(schooljaar)}</div>
          <h1>${escHtml(geselecteerdeKlas.naam)}
            ${geselecteerdeKlas.roulatie ? `<span style="font-size:13px;font-weight:600;padding:3px 10px;background:var(--amber-dim);color:var(--amber-text);border-radius:12px;margin-left:8px">⟳ ${getRoulatieLabel(geselecteerdeKlas)}</span>` : ''}
          </h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="jp-klas-select" onchange="jpSwitchKlas(this.value)" style="padding:10px 14px;border:1.5px solid var(--border-2);border-radius:var(--radius-sm);font-size:14px;background:var(--surface);font-family:var(--font);min-height:42px;color:var(--ink);font-weight:500">
            ${klassen.map(k => `<option value="${k.id}" ${k.id === geselecteerdeKlas.id ? 'selected' : ''}>${escHtml(k.naam)}${k.roulatie ? ' ⟳' : ''}</option>`).join('')}
          </select>
          ${!readonly ? `<button class="btn btn-primary" onclick="openOpdrachtModal()">+ Opdracht</button>` : ''}
        </div>
      </div>

      ${geselecteerdeKlas.roulatie ? `
      <div style="background:var(--amber-dim);border:1px solid rgba(217,119,6,0.2);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:18px">⟳</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--amber-text)">Roulatieklas — ${getRoulatieLabel(geselecteerdeKlas)}</div>
          <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${actieveWeken.length} actieve weken · ${inactieveWeken.length} inactieve weken worden grijs weergegeven</div>
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

  // Schooljaar volgorde: week 35–52 (najaar) eerst, dan week 1–34 (voorjaar)
  const gesorteerd = [...weken].sort((a, b) => {
    const schoolWeekNr = wn => wn >= 35 ? wn - 35 : wn + 52 - 35;
    return schoolWeekNr(a.weeknummer) - schoolWeekNr(b.weeknummer);
  });

  return gesorteerd.map(week => {
    const isVakantie = week.isVakantie || week.weektype === 'vakantie';
    const isHuidig = Number(week.weeknummer) === cw;
    const isRoulatieInactief = klas.roulatie && !isVakantie && !isRoulatieWeekActief(klas, week.weeknummer);

    // FIX: robuuste weekfilter — Number() voor type-safe vergelijking, trim() voor spaties
    const weekOpd = opdrachten.filter(o => {
      const wkNr = Number(week.weeknummer);
      const wekenStr = o.weken ? String(o.weken).trim() : null;
      if (!wekenStr) return Number(o.weeknummer) === wkNr;
      if (wekenStr.includes('-')) {
        const parts = wekenStr.split('-').map(n => parseInt(n.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return wkNr >= parts[0] && wkNr <= parts[1];
        }
      }
      return parseInt(wekenStr, 10) === wkNr;
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
      return `<div class="jp-week" style="opacity:0.35;background:var(--surface-2);border-color:var(--border)">
        <div class="jp-week-header">
          <span class="jp-week-nr" style="color:var(--ink-3)">Wk ${week.weeknummer}</span>
          <span class="jp-week-datum" style="color:var(--ink-3)">${week.van||''}</span>
          <span style="font-size:10px;color:var(--ink-3);font-weight:500">⟳ Klas niet actief</span>
        </div>
      </div>`;
    }

    return `<div class="jp-week ${isHuidig ? 'jp-week-huidig' : ''}">
      <div class="jp-week-header">
        <span class="jp-week-nr">${isHuidig ? `<span style="color:var(--accent)">▶</span> ` : ''}Week ${week.weeknummer}</span>
        <span class="jp-week-datum">${week.van||''}</span>
        ${week.thema ? `<span style="font-size:11.5px;color:var(--ink-3);font-style:italic;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:2px solid var(--border-2);padding-left:8px">${escHtml(week.thema)}</span>` : ''}
        <span style="margin-left:auto;font-size:11px;color:var(--ink-4)">${weekOpd.length ? `${weekOpd.length} opdracht${weekOpd.length !== 1 ? 'en' : ''}` : ''}</span>
        ${!readonly ? `
          <button class="icon-btn" onclick="jpBewijsThema('${week.id}', ${week.weeknummer}, ${JSON.stringify(week.thema || '')})" title="${week.thema ? 'Thema bewerken' : 'Thema instellen'}" style="color:${week.thema ? 'var(--accent)' : 'var(--ink-4)'}">
            <svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px"><path d="M13.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="icon-btn" onclick="openOpdrachtModal(null, ${week.weeknummer})" title="Opdracht toevoegen">
            <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>` : ''}
      </div>
      <div class="jp-opdrachten">
        ${weekOpd.length === 0
          ? `<div class="jp-leeg">Nog geen opdrachten voor deze week</div>`
          : weekOpd.map(o => renderOpdrachtKaart(o, readonly, week.weeknummer)).join('')
        }
      </div>
    </div>`;
  }).join('');
}

function jpBewijsThema(weekId, weeknummer, huidigThema) {
  openModal(`
    <h2>Weekthema — week ${weeknummer}</h2>
    <div class="form-grid">
      <div class="form-field form-full">
        <label>Thema (optioneel)</label>
        <input id="jp-thema-input" value="${escHtml(huidigThema)}" placeholder="bijv. Veiligheid op de werkplek" autofocus>
      </div>
    </div>
    <div class="modal-actions">
      ${huidigThema ? `<button class="btn" style="color:var(--red);border-color:rgba(220,38,38,0.3)" onclick="jpSlaThemaOp('${weekId}','')">Verwijderen</button>` : ''}
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="jpSlaThemaOp('${weekId}', document.getElementById('jp-thema-input').value.trim())">Opslaan</button>
    </div>
  `);
  setTimeout(() => document.getElementById('jp-thema-input')?.focus(), 50);
}

async function jpSlaThemaOp(weekId, thema) {
  try {
    await API.updateWeekThema(weekId, thema);
    Cache.invalidate('weken');
    closeModalDirect();
    renderJaarplanning();
  } catch(e) { showError(e.message); }
}

function typeKleurBalk(t) {
  const m = {
    'Theorie':        '#2563EB',
    'Opdracht':       '#16A34A',
    'Groepsopdracht': '#16A34A',
    'Toets':          '#D97706',
    'Eindtoets':      '#DC2626',
    'Praktijk':       '#9333EA',
    'Project':        '#0891B2',
    'Presentatie':    '#78716C',
    'Overig':         '#A8A29E',
  };
  return m[t] || '#A8A29E';
}

function renderOpdrachtKaart(o, readonly, weeknummer) {
  const afgevinkt = !!o.afgevinkt;
  const heeftOpmerking = !!(o.opmerking && o.opmerking.trim());
  const kleur = typeKleurBalk(o.type);
  const cw = getCurrentWeek();
  const weekVoorbij = weeknummer && Number(weeknummer) < cw;

  // Achtergrond + border van het hele blok op basis van status
  let bgKleur, borderKleur;
  if (afgevinkt && heeftOpmerking) {
    bgKleur = 'rgba(217,119,6,0.07)'; borderKleur = 'rgba(217,119,6,0.3)';
  } else if (afgevinkt) {
    bgKleur = 'rgba(22,163,74,0.07)'; borderKleur = 'rgba(22,163,74,0.2)';
  } else if (weekVoorbij) {
    bgKleur = 'rgba(220,38,38,0.05)'; borderKleur = 'rgba(220,38,38,0.18)';
  } else {
    bgKleur = 'var(--surface)'; borderKleur = 'var(--border)';
  }

  return `<div class="jp-opdracht ${afgevinkt ? 'jp-opdracht-afgevinkt' : ''}" data-id="${o.id}"
    style="border-color:${borderKleur};background:${bgKleur}">

    <div style="width:5px;flex-shrink:0;background:${kleur};${afgevinkt ? 'opacity:0.45' : ''}"></div>

    <div style="flex:1;padding:12px 14px;min-width:0">

      <div class="jp-opdracht-top">
        <span class="badge ${typeKleur(o.type)}">${escHtml(o.type)}</span>
        ${!readonly ? `<div style="display:flex;gap:4px;margin-left:auto">
          <button onclick="openOpmerkingModal('${o.id}')" title="${heeftOpmerking ? 'Opmerking bekijken' : 'Opmerking toevoegen'}"
            style="padding:4px 8px;font-size:12px;border-radius:5px;border:1px solid ${heeftOpmerking ? 'var(--amber)' : 'var(--border-2)'};background:${heeftOpmerking ? 'var(--amber-dim)' : 'transparent'};cursor:pointer;color:${heeftOpmerking ? 'var(--amber-text)' : 'var(--ink-3)'};font-family:var(--font)">
            ${heeftOpmerking ? '💬 Notitie' : '+ notitie'}
          </button>
          <button onclick="openOpdrachtModal('${o.id}')" title="Bewerken"
            style="padding:4px 8px;font-size:12px;border-radius:5px;border:1px solid var(--border-2);background:transparent;cursor:pointer;color:var(--ink-3);font-family:var(--font)">✎ Bewerk</button>
          <button onclick="deleteOpdracht('${o.id}')" title="Verwijderen"
            style="padding:4px 8px;font-size:12px;border-radius:5px;border:1px solid var(--border-2);background:transparent;cursor:pointer;color:var(--red);font-family:var(--font)">✕</button>
        </div>` : ''}
      </div>

      <div class="jp-opdracht-naam ${afgevinkt ? 'line-through' : ''}">${escHtml(o.naam)}</div>

      ${o.beschrijving ? `<div class="jp-opdracht-desc">${escHtml(o.beschrijving)}</div>` : ''}

      ${heeftOpmerking ? `<div style="font-size:12px;color:var(--amber-text);margin-top:6px;padding:6px 10px;background:var(--amber-dim);border-radius:5px;border-left:2px solid var(--amber)">💬 ${escHtml(o.opmerking)}</div>` : ''}

      <div class="jp-opdracht-meta">
        ${o.uren ? `<span style="font-size:11.5px;color:var(--ink-3);background:var(--surface-2);padding:2px 8px;border-radius:10px;border:1px solid var(--border)">⏱ ${o.uren}u</span>` : ''}
        ${o.syllabuscodes ? `<span style="font-size:11px;color:var(--ink-3);font-family:var(--font-mono)">${escHtml(jpFormatSyllabusCode(o.syllabuscodes))}</span>` : ''}
        ${o.theorieLink ? `<a href="${escHtml(o.theorieLink)}" target="_blank" onclick="event.stopPropagation()" style="font-size:11.5px;color:var(--blue-text);text-decoration:none;padding:2px 8px;background:var(--blue-dim);border-radius:10px;border:1px solid rgba(37,99,235,0.15)">📖 Theorie</a>` : ''}
        ${o.werkboekLink ? `<a href="${escHtml(o.werkboekLink)}" target="_blank" onclick="event.stopPropagation()" style="font-size:11.5px;color:var(--accent-text);text-decoration:none;padding:2px 8px;background:var(--accent-dim);border-radius:10px;border:1px solid rgba(22,163,74,0.15)">📗 Werkboek</a>` : ''}
        ${o.toetsBestand ? `<span style="font-size:11.5px;color:var(--amber-text);padding:2px 8px;background:var(--amber-dim);border-radius:10px;border:1px solid rgba(217,119,6,0.15)">📄 ${escHtml(o.toetsBestand)}</span>` : ''}
      </div>

      <div class="jp-opdracht-acties">
        <div style="display:flex;align-items:center;gap:8px">
          ${afgevinkt ? `<span style="font-size:12px;color:var(--accent-text);font-weight:600">✓ Afgerond</span>` : ''}
          ${afgevinkt && o.afgevinktDoor ? `<span style="font-size:11px;background:var(--accent);color:#fff;padding:2px 7px;border-radius:10px;font-weight:600">${escHtml(o.afgevinktDoor)}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${o.profielId ? `<button onclick="event.stopPropagation();openLesbrief('${o.id}')"
            style="padding:5px 10px;font-size:12px;border-radius:5px;border:1.5px solid var(--blue);background:var(--blue);color:#fff;cursor:pointer;font-weight:600;font-family:var(--font)">📋 Lesbrief</button>` : ''}
          ${!readonly ? `<button onclick="jpAfvinken('${o.id}')"
            style="padding:5px 12px;font-size:12px;font-weight:600;border-radius:5px;border:1.5px solid ${afgevinkt ? 'var(--accent)' : 'var(--border-2)'};background:${afgevinkt ? 'var(--accent-dim)' : 'var(--surface)'};color:${afgevinkt ? 'var(--accent-text)' : 'var(--ink-2)'};cursor:pointer;font-family:var(--font);transition:all 0.12s">${afgevinkt ? '✓ Afgerond' : 'Afvinken'}</button>` : ''}
        </div>
      </div>

    </div>
  </div>`;
}

async function jpSwitchKlas(klasId) {
  window._selectedKlas = klasId;
  renderJaarplanning();
}

async function jpAfvinken(opdrachtId) {
  if (!_jpKlas) return;
  try {
    await API.afvinken(opdrachtId);
    Cache.invalidate('opdrachten');
    _jpOpdrachten = await API.getOpdrachtenByKlas(_jpKlas.id);
    const cw = getCurrentWeek();
    document.getElementById('jp-grid').innerHTML = renderJpGrid(_jpWeken, _jpOpdrachten, _jpKlas, cw, !Auth.canEdit());
  } catch(e) { showError(e.message); }
}

// ============================================================
// OPDRACHT MODAL — volledig met alle velden + roulatie filter
// ============================================================
async function openOpdrachtModal(id = null, weeknr = null) {
  const o = id ? _jpOpdrachten.find(x => x.id === id) : null;
  const klas = _jpKlas;

  // Filter weken: niet vakantie + roulatie actief
  const beschikbareWeken = _jpWeken.filter(w =>
    !w.isVakantie &&
    w.weektype !== 'vakantie' &&
    (!klas.roulatie || isRoulatieWeekActief(klas, w.weeknummer))
  );

  const wekenOpties = beschikbareWeken.map(w =>
    `<option value="${w.weeknummer}" ${Number(o?.weeknummer || weeknr) === Number(w.weeknummer) ? 'selected' : ''}>Week ${w.weeknummer}${w.van ? ` · ${w.van}` : ''}${w.thema ? ` — ${w.thema}` : ''}</option>`
  ).join('');

  openModal(`
    <h2>${o ? 'Opdracht bewerken' : 'Nieuwe opdracht'}</h2>
    <p class="modal-sub">Klas: <strong>${escHtml(klas.naam)}</strong>${klas.roulatie ? ` <span style="color:var(--amber-text);font-size:12px">⟳ Roulatie — alleen actieve weken</span>` : ''}</p>
    <div class="form-grid">
      <div class="form-field" style="grid-column:1/-1">
        <label>Naam *</label>
        <input id="opd-naam" placeholder="bijv. Hoofdstuk 3 — Magnetisme" value="${escHtml(o?.naam||'')}">
      </div>
      <div class="form-field" style="grid-column:1/-1">
        <label>Beschrijving</label>
        <textarea id="opd-beschr" rows="2" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;resize:vertical">${escHtml(o?.beschrijving||'')}</textarea>
      </div>
      <div class="form-field"><label>Week *</label><select id="opd-week">${wekenOpties}</select></div>
      <div class="form-field"><label>Type</label><select id="opd-type">${['Theorie','Opdracht','Groepsopdracht','Toets','Eindtoets','Praktijk','Project','Presentatie','Overig'].map(t=>`<option value="${t}" ${(o?.type||'Opdracht')===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-field"><label>Uren</label><input id="opd-uren" type="number" step="0.5" min="0" placeholder="bijv. 2.5" value="${o?.uren||''}"></div>
      <div class="form-field"><label>Periode</label><select id="opd-periode">${[1,2,3,4].map(p=>`<option value="${p}" ${(o?.periode||1)===p?'selected':''}>Periode ${p}</option>`).join('')}</select></div>
      <div class="form-field"><label>Syllabuscodes</label><input id="opd-syllabus" placeholder="bijv. PIE-1.1, PIE-2.3" value="${escHtml(o?.syllabuscodes||'')}"></div>
      <div class="form-field"><label>Theorie link</label><input id="opd-link" type="url" placeholder="https://..." value="${escHtml(o?.theorieLink||'')}"></div>
      <div class="form-field"><label>Toetsbestand</label><input id="opd-toets" placeholder="bijv. toets_periode1.pdf" value="${escHtml(o?.toetsBestand||'')}"></div>
      <div class="form-field"><label>Werkboek link</label><input id="opd-werkboek" type="url" placeholder="https://..." value="${escHtml(o?.werkboekLink||'')}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveOpdracht('${id||''}')">Opslaan</button>
    </div>
  `);
}

async function saveOpdracht(id) {
  if (!_jpKlas) return;
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
    syllabuscodes: jpFormatSyllabusCode(document.getElementById('opd-syllabus').value.trim()) || null,
    theorieLink: document.getElementById('opd-link').value.trim() || null,
    toetsBestand: document.getElementById('opd-toets').value.trim() || null,
    werkboekLink: document.getElementById('opd-werkboek').value.trim() || null,
  };

  try {
    if (id) { await API.updateOpdracht(id, data); } else { await API.addOpdracht(data); }
    Cache.invalidate('opdrachten');
    closeModalDirect();
    _jpOpdrachten = await API.getOpdrachtenByKlas(_jpKlas.id);
    const cw = getCurrentWeek();
    document.getElementById('jp-grid').innerHTML = renderJpGrid(_jpWeken, _jpOpdrachten, _jpKlas, cw, !Auth.canEdit());
  } catch(e) { showError(e.message); }
}

// ============================================================
// OPMERKING MODAL
// ============================================================
async function openOpmerkingModal(id) {
  const o = _jpOpdrachten.find(x => x.id === id);
  if (!o) return;

  openModal(`
    <h2>Opmerking toevoegen</h2>
    <p class="modal-sub">${escHtml(o.naam)}</p>
    <div class="form-field">
      <label>Opmerking</label>
      <textarea id="opmerking-tekst" rows="4" placeholder="Voeg een interne opmerking toe..." style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;resize:vertical">${escHtml(o.opmerking||'')}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      ${o.opmerking ?
        `<button class="btn btn-danger" onclick="saveOpmerking('${id}', true)">Verwijderen</button>` : ''}
      <button class="btn btn-primary" onclick="saveOpmerking('${id}', false)">Opslaan</button>
    </div>
  `);
}

async function saveOpmerking(id, verwijder) {
  const tekst = verwijder ? null : document.getElementById('opmerking-tekst').value.trim() || null;
  try {
    await API.setOpmerking(id, tekst);
    const idx = _jpOpdrachten.findIndex(o => o.id === id);
    if (idx !== -1) _jpOpdrachten[idx] = { ..._jpOpdrachten[idx], opmerking: tekst };
    closeModalDirect();
    const cw = getCurrentWeek();
    document.getElementById('jp-grid').innerHTML = renderJpGrid(_jpWeken, _jpOpdrachten, _jpKlas, cw, !Auth.canEdit());
  } catch(e) { showError(e.message); }
}

// ============================================================
// VERWIJDEREN
// ============================================================
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

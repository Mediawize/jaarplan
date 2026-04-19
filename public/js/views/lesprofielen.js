// ============================================================
// LESPROFIELEN.JS — Lesprofielen aanmaken en beheren
// ============================================================

function renderLesprofielen() {
  if (!Auth.canEdit()) {
    document.getElementById('view-lesprofielen').innerHTML = `
      <div class="empty-state"><h3>Geen toegang</h3><p>Alleen docenten en beheerders kunnen lesprofielen beheren.</p></div>
    `;
    return;
  }

  const vakken = DB.getVakken();
  const profielen = DB.getLesprofielen(Auth.isAdmin() ? null : Auth.currentUser.id);

  // Groepeer per vak
  const perVak = {};
  profielen.forEach(p => {
    if (!perVak[p.vakId]) perVak[p.vakId] = [];
    perVak[p.vakId].push(p);
  });

  document.getElementById('view-lesprofielen').innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Lesprofielen</h1>
      </div>
      <button class="btn btn-primary" onclick="openProfielModal()">
        <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Nieuw lesprofiel
      </button>
    </div>

    <div class="alert alert-info" style="margin-bottom:20px">
      Een lesprofiel is een blok van meerdere weken met daarin per week de activiteiten (theorie, praktijk, toets). Je koppelt het profiel daarna aan een startweek in de jaarplanning.
    </div>

    ${profielen.length === 0 ? `
      <div class="card">
        <div class="empty-state">
          <h3>Nog geen lesprofielen</h3>
          <p>Maak een lesprofiel aan om snel meerdere weken in te plannen.</p>
          <button class="btn btn-primary" onclick="openProfielModal()">Eerste lesprofiel aanmaken</button>
        </div>
      </div>
    ` : vakken.map(vak => {
      const vp = perVak[vak.id] || [];
      if (!vp.length) return '';
      return `
        <div class="card" style="margin-bottom:20px">
          <div class="card-header">
            <div>
              <h2>${escHtml(vak.naam)} — ${escHtml(vak.volledig)}</h2>
              <div class="card-meta">${vp.length} profiel${vp.length !== 1 ? 'en' : ''}</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="openProfielModal('${vak.id}')">+ Profiel voor ${escHtml(vak.naam)}</button>
          </div>
          <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            ${vp.map(p => {
              const maker = DB.getGebruiker(p.docentId);
              const aantalActs = (p.weken || []).reduce((t, w) => t + (w.activiteiten?.length || 0), 0);
              return `
                <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;cursor:pointer;transition:box-shadow .15s" onclick="openProfielDetail('${p.id}')" onmouseover="this.style.boxShadow='var(--shadow)'" onmouseout="this.style.boxShadow='none'">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                    <div style="font-weight:600;font-size:14px">${escHtml(p.naam)}</div>
                    <div style="display:flex;gap:4px">
                      <button class="icon-btn" onclick="event.stopPropagation();openProfielModal('${p.vakId}','${p.id}')" title="Bewerken">
                        <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </button>
                      <button class="icon-btn" onclick="event.stopPropagation();deleteProfiel('${p.id}')" style="color:var(--red)" title="Verwijderen">
                        <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">
                    ${p.aantalWeken} weken · ${aantalActs} activiteiten
                    ${maker ? `· ${escHtml(maker.naam)}` : ''}
                  </div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${(p.weken || []).slice(0,4).map((w,i) => `
                      <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--cream);border:1px solid var(--border);color:var(--ink-muted)">W${i+1}: ${(w.activiteiten||[]).map(a=>a.type).join('+') || '—'}</span>
                    `).join('')}
                    ${p.aantalWeken > 4 ? `<span style="font-size:10px;color:var(--ink-muted)">+${p.aantalWeken-4} meer</span>` : ''}
                  </div>
                  <button class="btn btn-sm btn-primary" style="width:100%;margin-top:12px" onclick="event.stopPropagation();openKoppelModal('${p.id}')">
                    Koppelen aan planning →
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;
}

// ---- PROFIEL AANMAKEN / BEWERKEN ----
function openProfielModal(vakId = null, profielId = null) {
  const p = profielId ? DB.getLesprofiel(profielId) : null;
  const vakken = DB.getVakken();
  const selectedVak = vakId || p?.vakId || vakken[0]?.id;
  const aantalWeken = p?.aantalWeken || 4;

  openModal(`
    <h2>${p ? 'Lesprofiel bewerken' : 'Nieuw lesprofiel'}</h2>
    <p class="modal-sub">Geef het profiel een naam en geef aan hoeveel weken het beslaat. Je vult de weekinhoud daarna in.</p>

    <div class="form-grid">
      <div class="form-field">
        <label>Naam profiel *</label>
        <input id="prof-naam" placeholder="bijv. Introductie ondernemen" value="${escHtml(p?.naam || '')}">
      </div>
      <div class="form-field">
        <label>Vak *</label>
        <select id="prof-vak">
          ${vakken.map(v => `<option value="${v.id}" ${v.id === selectedVak ? 'selected' : ''}>${escHtml(v.naam)} — ${escHtml(v.volledig)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Aantal weken *</label>
        <select id="prof-weken">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${aantalWeken===n?'selected':''}>${n} ${n===1?'week':'weken'}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Uren per week (voor dit vak)</label>
        <select id="prof-uren">
          ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${(p?.urenPerWeek||2)===n?'selected':''}>${n} uur per week</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Beschrijving / toelichting</label>
        <textarea id="prof-beschrijving" placeholder="Wat is het doel van dit profiel?">${escHtml(p?.beschrijving || '')}</textarea>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveProfiel('${profielId || ''}')">
        ${p ? 'Opslaan' : 'Profiel aanmaken →'}
      </button>
    </div>
  `);
}

function saveProfiel(profielId) {
  const naam = document.getElementById('prof-naam').value.trim();
  const vakId = document.getElementById('prof-vak').value;
  const aantalWeken = parseInt(document.getElementById('prof-weken').value);
  const urenPerWeek = parseInt(document.getElementById('prof-uren').value);
  const beschrijving = document.getElementById('prof-beschrijving').value.trim();

  if (!naam || !vakId) { alert('Vul naam en vak in.'); return; }

  const bestaand = profielId ? DB.getLesprofiel(profielId) : null;

  // Bouw wekenstructuur op (behoud bestaande activiteiten bij bewerken)
  const weken = Array.from({ length: aantalWeken }, (_, i) => {
    const bestaandeWeek = bestaand?.weken?.[i];
    return bestaandeWeek || { weekIndex: i + 1, thema: '', activiteiten: [] };
  });

  const data = { naam, vakId, aantalWeken, urenPerWeek, beschrijving, weken, docentId: Auth.currentUser.id };

  if (profielId) {
    DB.updateLesprofiel(profielId, data);
  } else {
    const nieuw = DB.addLesprofiel(data);
    profielId = nieuw.id;
  }

  closeModalDirect();
  openProfielDetail(profielId);
}

// ---- PROFIEL DETAIL / WEEKINHOUD INVULLEN ----
function openProfielDetail(profielId) {
  const p = DB.getLesprofiel(profielId);
  if (!p) return;
  const vak = DB.getVak(p.vakId);

  // Render als full-page overlay boven de normale view
  const overlay = document.createElement('div');
  overlay.id = 'profiel-detail-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--cream);z-index:500;overflow-y:auto;padding:36px 40px';
  overlay.innerHTML = `
    <div style="max-width:960px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px">
        <button class="btn" onclick="document.getElementById('profiel-detail-overlay').remove(); renderLesprofielen()">
          ← Terug
        </button>
        <div>
          <div style="font-size:12px;color:var(--ink-muted)">Lesprofiel · ${escHtml(vak?.naam || '')}</div>
          <h1 style="font-family:'DM Serif Display',serif;font-size:24px;font-weight:400">${escHtml(p.naam)}</h1>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <span style="font-size:13px;color:var(--ink-muted);align-self:center">${p.aantalWeken} weken · ${p.urenPerWeek} uur/week</span>
          <button class="btn btn-primary" onclick="openKoppelModal('${p.id}')">Koppelen aan planning →</button>
        </div>
      </div>

      <div id="profiel-weken-container">
        ${renderProfielWeken(p)}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function renderProfielWeken(p) {
  return (p.weken || []).map((w, i) => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <h2>Week ${i + 1}</h2>
          <div class="card-meta">${p.urenPerWeek} uur beschikbaar</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input
            type="text"
            placeholder="Thema van deze week..."
            value="${escHtml(w.thema || '')}"
            onchange="updateProfielWeekThema('${p.id}', ${i}, this.value)"
            style="padding:7px 12px;border:1.5px solid var(--border-med);border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:13px;width:220px;outline:none"
          >
          <button class="btn btn-sm btn-primary" onclick="addActiviteit('${p.id}', ${i})">+ Activiteit</button>
        </div>
      </div>

      <div id="activiteiten-week-${p.id}-${i}">
        ${renderActiviteiten(p, i)}
      </div>

      ${(w.activiteiten || []).length === 0 ? `
        <div style="padding:20px 24px;color:var(--ink-muted);font-size:13px">
          Nog geen activiteiten. Klik op "+ Activiteit" om theorie, praktijk of een toets toe te voegen.
        </div>
      ` : ''}
    </div>
  `).join('');
}

function renderActiviteiten(p, weekIdx) {
  const w = p.weken[weekIdx];
  if (!w?.activiteiten?.length) return '';

  return `<table class="data-table">
    <thead>
      <tr>
        <th>Type</th>
        <th>Uren</th>
        <th>Omschrijving</th>
        <th>Link / bestand</th>
        <th style="width:60px"></th>
      </tr>
    </thead>
    <tbody>
      ${w.activiteiten.map((a, ai) => `
        <tr>
          <td><span class="badge ${actTypeKleur(a.type)}">${escHtml(a.type)}</span></td>
          <td style="font-size:13px;font-weight:500">${a.uren} uur</td>
          <td style="font-size:13px">${escHtml(a.omschrijving || '—')}</td>
          <td>
            ${a.link ? `<a href="${escHtml(a.link)}" class="text-link" target="_blank">${escHtml(a.link.length > 40 ? a.link.slice(0,40)+'…' : a.link)}</a>` : ''}
            ${a.bestand ? `<span class="badge badge-amber" style="font-size:11px">📄 ${escHtml(a.bestand)}</span>` : ''}
            ${!a.link && !a.bestand ? '<span style="color:var(--ink-muted)">—</span>' : ''}
          </td>
          <td>
            <button class="icon-btn" onclick="deleteActiviteit('${p.id}', ${weekIdx}, ${ai})" style="color:var(--red)" title="Verwijderen">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function actTypeKleur(type) {
  const map = { 'Theorie': 'badge-blue', 'Praktijk': 'badge-green', 'Toets': 'badge-amber', 'Presentatie': 'badge-gray', 'Overig': 'badge-gray' };
  return map[type] || 'badge-gray';
}

function updateProfielWeekThema(profielId, weekIdx, thema) {
  const p = DB.getLesprofiel(profielId);
  if (!p) return;
  p.weken[weekIdx].thema = thema;
  DB.updateLesprofiel(profielId, { weken: p.weken });
}

function addActiviteit(profielId, weekIdx) {
  const p = DB.getLesprofiel(profielId);
  if (!p) return;

  openModal(`
    <h2>Activiteit toevoegen</h2>
    <p class="modal-sub">Week ${weekIdx + 1} van "${escHtml(p.naam)}" · ${p.urenPerWeek} uur beschikbaar</p>

    <div class="form-grid">
      <div class="form-field">
        <label>Type activiteit *</label>
        <select id="act-type">
          <option>Theorie</option>
          <option>Praktijk</option>
          <option>Toets</option>
          <option>Presentatie</option>
          <option>Overig</option>
        </select>
      </div>
      <div class="form-field">
        <label>Aantal uren *</label>
        <select id="act-uren">
          ${[0.5,1,1.5,2,2.5,3,4].map(u => `<option value="${u}" ${u===1?'selected':''}>${u} uur</option>`).join('')}
        </select>
      </div>
      <div class="form-field form-full">
        <label>Omschrijving</label>
        <input id="act-omschrijving" placeholder="bijv. Uitleg businessmodel canvas">
      </div>
      <div class="form-field form-full">
        <label>Link (naar theorie, opdracht of toets)</label>
        <input id="act-link" type="url" placeholder="https://...">
      </div>
      <div class="form-field form-full">
        <label>Syllabuscodes</label>
        <input id="act-syllabus" placeholder="bijv. PIE-1.1, PIE-1.2">
      </div>
      <div class="form-field form-full">
        <label>Bestandsnaam (na uploaden via Toetsen & Materialen)</label>
        <input id="act-bestand" placeholder="bijv. toets_p1.pdf">
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveActiviteit('${profielId}', ${weekIdx})">Toevoegen</button>
    </div>
  `);
}

function saveActiviteit(profielId, weekIdx) {
  const type = document.getElementById('act-type').value;
  const uren = parseFloat(document.getElementById('act-uren').value);
  const omschrijving = document.getElementById('act-omschrijving').value.trim();
  const link = document.getElementById('act-link').value.trim();
  const syllabus = document.getElementById('act-syllabus').value.trim();
  const bestand = document.getElementById('act-bestand').value.trim();

  const p = DB.getLesprofiel(profielId);
  if (!p) return;

  p.weken[weekIdx].activiteiten = p.weken[weekIdx].activiteiten || [];
  p.weken[weekIdx].activiteiten.push({ type, uren, omschrijving, link, syllabus, bestand: bestand || null });
  DB.updateLesprofiel(profielId, { weken: p.weken });

  closeModalDirect();
  // Refresh de activiteitenlijst
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container) container.innerHTML = renderActiviteiten(DB.getLesprofiel(profielId), weekIdx);
  // Verberg lege staat
  const emptyEl = container?.nextElementSibling;
  if (emptyEl && emptyEl.textContent.includes('Nog geen activiteiten')) emptyEl.style.display = 'none';
}

function deleteActiviteit(profielId, weekIdx, actIdx) {
  if (!confirm('Activiteit verwijderen?')) return;
  const p = DB.getLesprofiel(profielId);
  p.weken[weekIdx].activiteiten.splice(actIdx, 1);
  DB.updateLesprofiel(profielId, { weken: p.weken });
  const container = document.getElementById(`activiteiten-week-${profielId}-${weekIdx}`);
  if (container) container.innerHTML = renderActiviteiten(DB.getLesprofiel(profielId), weekIdx);
}

function deleteProfiel(id) {
  const p = DB.getLesprofiel(id);
  if (!confirm(`Lesprofiel "${p?.naam}" verwijderen?`)) return;
  DB.deleteLesprofiel(id);
  renderLesprofielen();
}

// ---- KOPPELEN AAN JAARPLANNING ----
function openKoppelModal(profielId) {
  const p = DB.getLesprofiel(profielId);
  if (!p) return;
  const vak = DB.getVak(p.vakId);

  // Klassen die dit vak hebben
  const klassen = Auth.getZichtbareKlassen().filter(k => k.vakId === p.vakId);

  openModal(`
    <h2>Profiel koppelen aan planning</h2>
    <p class="modal-sub">Koppel "<strong>${escHtml(p.naam)}</strong>" (${p.aantalWeken} weken) aan een startweek in de jaarplanning.</p>

    <div class="form-grid">
      <div class="form-field">
        <label>Klas *</label>
        <select id="koppel-klas" onchange="refreshKoppelWeken()">
          ${klassen.length === 0
            ? `<option value="">Geen klassen met vak ${escHtml(vak?.naam)}</option>`
            : klassen.map(k => `<option value="${k.id}">${escHtml(k.naam)} — ${escHtml(k.schooljaar)}</option>`).join('')
          }
        </select>
      </div>
      <div class="form-field">
        <label>Startweek *</label>
        <select id="koppel-startweek">
          <option value="">— Selecteer klas eerst —</option>
        </select>
      </div>
    </div>

    <div id="koppel-preview" style="margin-top:12px"></div>

    <div class="modal-actions">
      <button class="btn" onclick="closeModalDirect()">Annuleren</button>
      <button class="btn btn-primary" onclick="saveKoppeling('${profielId}')">Koppelen → planning invullen</button>
    </div>
  `);

  // Init weken voor eerste klas
  setTimeout(() => refreshKoppelWeken(p), 100);
}

function refreshKoppelWeken(profiel = null) {
  const klasId = document.getElementById('koppel-klas')?.value;
  if (!klasId) return;
  const klas = DB.getKlas(klasId);
  const weken = DB.getWeken(klas?.schooljaar).filter(w => !w.isVakantie);
  const sel = document.getElementById('koppel-startweek');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecteer startweek —</option>` +
    weken.map(w => `<option value="${w.weeknummer}">Wk ${w.weeknummer} · ${w.van} – ${w.tot}${w.thema ? ' · ' + w.thema : ''}</option>`).join('');

  sel.onchange = () => {
    const sw = parseInt(sel.value);
    if (!sw || !profiel) return;
    const p = profiel || DB.getLesprofiel(document.querySelector('[id^=koppel]')?.dataset?.profielId);
    if (!p) return;
    // Toon preview
    const schoolWeken = weken.filter(w => w.weeknummer >= sw).slice(0, p.aantalWeken);
    document.getElementById('koppel-preview').innerHTML = `
      <div class="alert alert-success">
        Profiel wordt gekoppeld aan week ${schoolWeken[0]?.weeknummer || sw} t/m ${schoolWeken[schoolWeken.length-1]?.weeknummer || (sw + p.aantalWeken - 1)}<br>
        <small style="opacity:.7">${schoolWeken.length} schoolweken (vakanties overgeslagen)</small>
      </div>
    `;
  };
}

function saveKoppeling(profielId) {
  const klasId = document.getElementById('koppel-klas').value;
  const startweek = parseInt(document.getElementById('koppel-startweek').value);

  if (!klasId || !startweek) { alert('Selecteer een klas en startweek.'); return; }

  const p = DB.getLesprofiel(profielId);
  const klas = DB.getKlas(klasId);
  const alleWeken = DB.getWeken(klas?.schooljaar).filter(w => !w.isVakantie);
  const startIdx = alleWeken.findIndex(w => w.weeknummer === startweek);
  const schoolWeken = alleWeken.slice(startIdx, startIdx + p.aantalWeken);

  // Maak voor elke week in het profiel een opdracht aan per activiteit
  schoolWeken.forEach((sw, i) => {
    const pw = p.weken[i];
    if (!pw) return;

    (pw.activiteiten || []).forEach(act => {
      DB.addOpdracht({
        naam: act.omschrijving || `${act.type} — ${escHtml(p.naam)}`,
        klasId,
        periode: getPeriodeVoorWeek(sw.weeknummer),
        weeknummer: sw.weeknummer,
        weken: String(sw.weeknummer),
        schooljaar: klas.schooljaar,
        type: act.type,
        syllabuscodes: act.syllabus || '',
        werkboekLink: '',
        beschrijving: `Uit lesprofiel: ${p.naam} (week ${i+1} van ${p.aantalWeken})`,
        theorieLink: act.link || '',
        toetsBestand: act.bestand || null,
        uren: act.uren,
        profielId: p.id,
      });
    });

    // Update ook weekthema als het profiel een thema heeft
    if (pw.thema) {
      DB.updateWeekThema(klas.schooljaar, sw.id, pw.thema);
    }
  });

  closeModalDirect();
  // Verwijder profiel detail overlay als die open is
  document.getElementById('profiel-detail-overlay')?.remove();

  // Navigeer naar de jaarplanning
  window._selectedKlas = klasId;
  showView('jaarplanning');
}

function getPeriodeVoorWeek(wn) {
  if (wn >= 35 && wn <= 43) return 1;
  if (wn >= 44 || wn <= 8) return 2;
  if (wn >= 9 && wn <= 18) return 3;
  return 4;
}

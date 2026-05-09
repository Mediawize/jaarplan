// ============================================================
// public/js/views/lesbrieven.js
// Layout gebaseerd op Lesvoorbereidingsformulier (Bijlage 1)
// ============================================================

const _lb = {
  id: null,
  profielId: null,
  weekIdx: null,
  actIdx: null,
  opdrachtId: null,
  activiteitInfo: null,
  data: null,
  stap: 1,
  opgeslagen: true,
};

// ============================================================
// ENTRY POINT
// Nieuwe signatuur: openLesbrief(opdrachtId)
// Backward compat: openLesbrief(profielId, weekIdx, actIdx, info)
// ============================================================
async function openLesbrief(profielIdOfOpdrachtId, weekIdx, actIdx, activiteitInfo) {
  _lb.stap = 1;
  _lb.opgeslagen = true;

  // Detecteer nieuw (opdrachtId) vs oud (profielId+weekIdx+actIdx) aanroep
  const isNieuweSignatuur = weekIdx === undefined && actIdx === undefined;

  if (isNieuweSignatuur) {
    // Nieuw: gekoppeld aan een opdracht
    const opdrachtId = profielIdOfOpdrachtId;
    _lb.opdrachtId = opdrachtId;
    _lb.profielId = null;
    _lb.weekIdx = null;
    _lb.actIdx = null;

    // Haal opdracht op voor auto-invul
    try {
      const opdRes = await fetch(`/api/opdrachten/${opdrachtId}`, { credentials: 'same-origin' });
      const opdracht = await opdRes.json();
      _lb.activiteitInfo = {
        naam: opdracht.naam || '',
        omschrijving: opdracht.naam || '',
        type: opdracht.type || '',
        uren: opdracht.uren || 1,
        klas: opdracht.klasId || '',
        weeknummer: opdracht.weeknummer || '',
        theorieLink: opdracht.theorieLink || '',
        syllabuscodes: opdracht.syllabuscodes || '',
      };
    } catch { _lb.activiteitInfo = {}; }

    // Zoek bestaande lesbrief op opdrachtId
    try {
      const lijst = await API.getLesbriefByOpdracht(opdrachtId);
      if (lijst && lijst.length > 0) {
        _lb.id = lijst[0].id;
        _lb.data = lijst[0].data && Object.keys(lijst[0].data).length > 0 ? lijst[0].data : lbLeeg();
        lbToonOverzicht();
        return;
      }
    } catch { /* geen lesbrief */ }
  } else {
    // Oud: profielId + weekIdx + actIdx
    _lb.profielId = profielIdOfOpdrachtId;
    _lb.weekIdx = weekIdx;
    _lb.actIdx = actIdx;
    _lb.opdrachtId = null;
    _lb.activiteitInfo = activiteitInfo || {};

    try {
      const res = await fetch(`/api/lesbrieven?profielId=${profielIdOfOpdrachtId}&weekIdx=${weekIdx}&actIdx=${actIdx}`, { credentials: 'same-origin' });
      const lijst = await res.json();
      if (lijst && lijst.length > 0) {
        _lb.id = lijst[0].id;
        _lb.data = lijst[0].data && Object.keys(lijst[0].data).length > 0 ? lijst[0].data : lbLeeg();
        lbToonOverzicht();
        return;
      }
    } catch { /* geen lesbrief gevonden */ }
  }

  _lb.id = null;
  _lb.data = lbLeeg();
  renderLb();
}

// ============================================================
// OVERZICHT (lees-modus)
// ============================================================
function lbToonOverzicht() {
  const d = _lb.data;
  const info = _lb.activiteitInfo || {};

  function blok(label, tekst) {
    if (!tekst || !tekst.trim()) return '';
    return `<div style="margin-bottom:18px">
      <div style="font-weight:700;font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${label}</div>
      <div style="font-size:13px;white-space:pre-wrap;line-height:1.6">${escHtml(tekst)}</div>
    </div>`;
  }

  const faseringHtml = (d.fasering || []).length ? `
    <div style="margin-bottom:18px">
      <div style="font-weight:700;font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Fasering van de les</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:var(--accent);color:#fff">
              <th style="padding:7px 10px;text-align:left;font-weight:600">Fasering</th>
              <th style="padding:7px 10px;text-align:left;font-weight:600;white-space:nowrap">Tijd</th>
              <th style="padding:7px 10px;text-align:left;font-weight:600">Activiteit leraar</th>
              <th style="padding:7px 10px;text-align:left;font-weight:600">Activiteit leerlingen</th>
              <th style="padding:7px 10px;text-align:left;font-weight:600">Hulpmiddelen</th>
            </tr>
          </thead>
          <tbody>
            ${(d.fasering).map((f, i) => `
              <tr style="background:${i % 2 === 0 ? '#f3f9f5' : '#fff'}">
                <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:600;font-size:12px">${escHtml(f.fase||'')}</td>
                <td style="padding:8px 10px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--ink-muted)">${escHtml(f.tijd||'')}</td>
                <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${escHtml(f.activiteitLeraar||'')}</td>
                <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${escHtml(f.activiteitLeerling||'')}</td>
                <td style="padding:8px 10px;border-bottom:1px solid var(--border)">${escHtml(f.hulpmiddelen||'')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  openModal(`
    <div style="margin:-4px -4px 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:16px">
        <div>
          <h2 style="margin:0 0 4px;font-size:18px">📋 Lesbrief</h2>
          <div style="font-size:13px;color:var(--ink-muted)">
            ${info.type ? `<span style="background:var(--accent-dim);color:var(--accent);border-radius:4px;padding:1px 7px;font-size:12px;font-weight:600;margin-right:6px">${escHtml(info.type)}</span>` : ''}
            ${escHtml(info.omschrijving || info.naam || '')}${info.uren ? ` · ${info.uren} lesuren` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm" onclick="lbBewerken()">✏️ Bewerken</button>
          <button class="btn btn-primary btn-sm" onclick="lbDownload()">⬇ Download</button>
        </div>
      </div>

      <!-- Identificatieblok -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;background:#f9fafb;border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:13px">
        ${d.kandidaat ? `<div><span style="color:var(--ink-muted)">Kandidaat:</span> <strong>${escHtml(d.kandidaat)}</strong></div>` : ''}
        ${d.datumLes  ? `<div><span style="color:var(--ink-muted)">Datum:</span> <strong>${escHtml(d.datumLes)}</strong></div>` : ''}
        ${d.vak       ? `<div><span style="color:var(--ink-muted)">Vak:</span> ${escHtml(d.vak)}</div>` : ''}
        ${d.klas      ? `<div><span style="color:var(--ink-muted)">Klas:</span> ${escHtml(d.klas)}</div>` : ''}
        ${d.school    ? `<div><span style="color:var(--ink-muted)">School:</span> ${escHtml(d.school)}</div>` : ''}
        ${d.lokaal    ? `<div><span style="color:var(--ink-muted)">Lokaal:</span> ${escHtml(d.lokaal)}</div>` : ''}
        ${d.werkplekbegeleider ? `<div><span style="color:var(--ink-muted)">WPB:</span> ${escHtml(d.werkplekbegeleider)}</div>` : ''}
        ${d.methode   ? `<div><span style="color:var(--ink-muted)">Methode:</span> ${escHtml(d.methode)}</div>` : ''}
        ${d.onderwerp ? `<div style="grid-column:1/-1"><span style="color:var(--ink-muted)">Onderwerp:</span> <strong>${escHtml(d.onderwerp)}</strong></div>` : ''}
      </div>

      <div style="max-height:55vh;overflow-y:auto;padding-right:4px">
        ${blok('1) Lesdoel', d.lesdoel)}
        ${blok('Beginsituatie', d.beginsituatie)}
        ${blok('2) Wat doe ik? (en waarom)', d.watDoekIk)}
        ${blok('Wat doet de leerling? (waartoe)', d.watDoetDeLeerling)}
        ${blok('3) Evaluatie', d.evaluatie)}
        ${blok('4) Resultaat & Reflectie', d.reflectie)}
        ${faseringHtml}
      </div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModalDirect()">Sluiten</button>
        <button class="btn btn-sm" onclick="lbBewerken()">✏️ Bewerken</button>
        <button class="btn btn-primary" onclick="lbDownload()">⬇ Download</button>
      </div>
    </div>
  `);

  setTimeout(() => {
    const box = document.querySelector('#modal-overlay .modal-box');
    if (box) box.style.maxWidth = '900px';
  }, 0);
}

function lbBewerken() {
  _lb.stap = 1;
  renderLb();
}


function lbLeeg() {
  const info = _lb.activiteitInfo || {};
  return {
    // Identificatie
    kandidaat: '',
    datumLes: '',
    werkplekbegeleider: '',
    vak: info.vak || '',
    klas: info.klas || '',
    school: '',
    lokaal: '',
    onderwerp: info.omschrijving || info.naam || '',
    methode: info.type || 'Theorie',
    // Lesdoel
    lesdoel: '',
    beginsituatie: '',
    // Didactiek
    watDoekIk: '',
    watDoetDeLeerling: '',
    // Evaluatie
    evaluatie: '',
    // Reflectie
    reflectie: '',
    // Fasering
    fasering: [
      { fase: 'Fase 1 — Docent geeft leerdoelen aan',       tijd: '0:00–05:00',  activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: '' },
      { fase: 'Fase 2 — Docent activeert voorkennis',        tijd: '05:00–15:00', activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: '' },
      { fase: 'Fase 3 — Docent geeft instructie',            tijd: '15:00–25:00', activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: '' },
      { fase: 'Fase 4 — Leerlingen werken zelfstandig',      tijd: '25:00–35:00', activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: '' },
      { fase: 'Fase 5 — Docent koppelt leerdoelen terug',    tijd: '35:00–40:00', activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: '' },
      { fase: 'Fase 6 — Reflectie op product en proces',     tijd: '40:00–45:00', activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: '' },
    ],
  };
}

// ============================================================
// STAPPEN
// ============================================================
const LB_STAPPEN = [
  { id: 'identificatie', label: 'Gegevens' },
  { id: 'lesdoel',       label: 'Lesdoel' },
  { id: 'didactiek',     label: 'Didactiek' },
  { id: 'evaluatie',     label: 'Evaluatie' },
  { id: 'reflectie',     label: 'Resultaat & Reflectie' },
  { id: 'fasering',      label: 'Fasering' },
];

// ============================================================
// RENDER MODAL
// ============================================================
function renderLb() {
  const s = _lb.stap;
  const totaal = LB_STAPPEN.length;
  const huidigId = LB_STAPPEN[s - 1].id;
  const huidigLabel = LB_STAPPEN[s - 1].label;
  const info = _lb.activiteitInfo || {};
  const ro = !Auth.canEdit();

  openModal(`
    <div style="margin:-4px -4px 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:10px">
        <div>
          <h2 style="margin:0 0 4px;font-size:18px">📄 Lesbrief — stap ${s} van ${totaal}: ${huidigLabel}</h2>
          <div style="font-size:13px;color:var(--ink-muted)">
            ${info.type ? `<span style="background:var(--accent-dim);color:var(--accent);border-radius:4px;padding:1px 7px;font-size:12px;font-weight:600;margin-right:6px">${escHtml(info.type)}</span>` : ''}
            ${escHtml(info.omschrijving || info.naam || '')}${info.uren ? ` · ${info.uren} lesuren (45 min)` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${!ro ? `<button class="btn btn-sm" onclick="lbGenereerAI()" id="lb-ai-btn">✨ AI invullen</button>` : ''}
          ${!ro ? `<button class="btn btn-sm" onclick="lbOpslaan()" id="lb-opslaan-btn">💾 Opslaan</button>` : ''}
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div style="display:flex;gap:4px;margin-bottom:6px">
          ${LB_STAPPEN.map((_, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i < s ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--ink-muted)">Stap ${s} van ${totaal}</div>
      </div>

      <div id="lb-ai-status" style="font-size:13px;margin-bottom:8px"></div>
      <div id="lb-tab-inhoud">${lbRenderTab(huidigId, ro)}</div>
      <div id="lb-opslaan-status" style="font-size:13px;margin-top:8px"></div>

      <div class="modal-actions">
        ${s === 1
          ? `<button class="btn" onclick="closeModalDirect()">Sluiten</button>`
          : `<button class="btn" onclick="lbVorigeStap()">← Vorige</button>`
        }
        ${s < totaal
          ? `<button class="btn btn-primary" onclick="lbVolgendeStap()">Volgende →</button>`
          : `<button class="btn btn-primary" onclick="lbOpslaan()">💾 Opslaan</button>`
        }
      </div>
    </div>
  `);

  setTimeout(() => {
    const box = document.querySelector('#modal-overlay .modal-box');
    if (box) box.style.maxWidth = '900px';
    lbInjectStijlen();
    if (huidigId === 'fasering') lbAutoResizeFasering();
  }, 0);
}

function lbInjectStijlen() {
  if (document.getElementById('lb-stijlen')) return;
  const s = document.createElement('style');
  s.id = 'lb-stijlen';
  s.textContent = `
    .lb-textarea { width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;box-sizing:border-box;resize:vertical; }
    .lb-textarea:focus { outline:none;border-color:var(--accent); }
    .lb-input { padding:6px 9px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:inherit;box-sizing:border-box; }
    .lb-input:focus { outline:none;border-color:var(--accent); }
    .lb-del-btn { color:var(--red);border:none;background:none;cursor:pointer;font-size:14px;padding:3px 4px;flex-shrink:0; }
    .lb-fase-tabel { width:100%;border-collapse:collapse;font-size:13px; }
    .lb-fase-tabel th { background:var(--accent);color:#fff;padding:8px 10px;text-align:left;font-weight:600;font-size:12px; }
    .lb-fase-tabel td { padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top; }
    .lb-fase-tabel tr:nth-child(even) td { background:#f9fafb; }
    .lb-fase-tabel .lb-td-input { border:none;width:100%;background:transparent;font-size:13px;font-family:inherit;padding:2px 4px;border-radius:4px; }
    .lb-fase-tabel .lb-td-input:focus { outline:2px solid var(--accent);background:#fff; }
    .lb-fase-tabel textarea.lb-td-input { resize:vertical;min-height:52px; }
  `;
  document.head.appendChild(s);
}

function lbAutoResizeFasering() {
  document.querySelectorAll('.lb-fase-tabel textarea').forEach(el => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  });
}

// ============================================================
// NAVIGATIE
// ============================================================
function lbVorigeStap() { lbLeesData(); _lb.stap--; renderLb(); }
function lbVolgendeStap() { lbLeesData(); _lb.stap++; renderLb(); }

// ============================================================
// STAP INHOUD
// ============================================================
function lbRenderTab(tabId, ro) {
  const d = _lb.data;

  // ---- IDENTIFICATIE ----
  if (tabId === 'identificatie') {
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin:0 0 14px">Basisgegevens van de les.</p>
      <div class="form-grid">
        <div class="form-field"><label>Kandidaat / Docent</label><input id="lb-kandidaat" class="lb-input" style="width:100%" value="${escHtml(d.kandidaat||'')}" ${ro?'readonly':''} placeholder="Naam docent"></div>
        <div class="form-field"><label>Datum les</label><input id="lb-datuml" class="lb-input" style="width:100%" value="${escHtml(d.datumLes||'')}" ${ro?'readonly':''} placeholder="bijv. 28-03-2025"></div>
        <div class="form-field"><label>Vak</label><input id="lb-vak" class="lb-input" style="width:100%" value="${escHtml(d.vak||'')}" ${ro?'readonly':''} placeholder="Vaknaam"></div>
        <div class="form-field"><label>Klas</label><input id="lb-klas" class="lb-input" style="width:100%" value="${escHtml(d.klas||'')}" ${ro?'readonly':''} placeholder="bijv. GL3"></div>
        <div class="form-field"><label>School</label><input id="lb-school" class="lb-input" style="width:100%" value="${escHtml(d.school||'')}" ${ro?'readonly':''} placeholder="Schoolnaam"></div>
        <div class="form-field"><label>Lokaal</label><input id="lb-lokaal" class="lb-input" style="width:100%" value="${escHtml(d.lokaal||'')}" ${ro?'readonly':''} placeholder="bijv. 204"></div>
        <div class="form-field"><label>Werkplekbegeleider</label><input id="lb-wpb" class="lb-input" style="width:100%" value="${escHtml(d.werkplekbegeleider||'')}" ${ro?'readonly':''} placeholder="Naam begeleider"></div>
        <div class="form-field"><label>Methode</label><input id="lb-methode" class="lb-input" style="width:100%" value="${escHtml(d.methode||'')}" ${ro?'readonly':''} placeholder="bijv. Theorie / Praktijk"></div>
        <div class="form-field form-full"><label>Onderwerp / Hoofdstuk</label><input id="lb-onderwerp" class="lb-input" style="width:100%" value="${escHtml(d.onderwerp||'')}" ${ro?'readonly':''} placeholder="Onderwerp van de les"></div>
      </div>`;
  }

  // ---- LESDOEL ----
  if (tabId === 'lesdoel') {
    return `
      <div style="background:#f0f9ff;border-left:3px solid var(--accent);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--ink-muted)">
        <strong style="color:var(--accent)">Vraag 1:</strong> Wat wil ik de leerlingen leren? Wat is het lesdoel voor deze les en hoe verhoudt dat lesdoel zich tot PTA / eindtermen / kwalificatiedossier? (actiewerkwoorden — samenhang — niveau van leren, zichtbaar en meetbaar)
      </div>
      <div class="form-field" style="margin-bottom:14px">
        <label style="font-weight:600">Lesdoel(en)</label>
        <p style="font-size:12px;color:var(--ink-muted);margin:2px 0 6px">Formuleer als "Leerlingen kunnen..." of "Leerlingen kennen...". Gebruik actiewerkwoorden.</p>
        <textarea id="lb-lesdoel" rows="5" class="lb-textarea" ${ro?'readonly':''} placeholder="bijv. Leerlingen kunnen uitleggen wat een elektrische installatie is.&#10;Leerlingen herkennen symbolen in een installatieschema.">${escHtml(d.lesdoel||'')}</textarea>
      </div>
      <div class="form-field">
        <label style="font-weight:600">Beginsituatie</label>
        <p style="font-size:12px;color:var(--ink-muted);margin:2px 0 6px">Beschrijf de klas: niveau, eerdere kennis, bijzonderheden.</p>
        <textarea id="lb-beginsituatie" rows="4" class="lb-textarea" ${ro?'readonly':''} placeholder="bijv. VMBO GL3, basis- en kaderniveau, actieve groep. Eerder aan bod geweest: ...">${escHtml(d.beginsituatie||'')}</textarea>
      </div>`;
  }

  // ---- DIDACTIEK ----
  if (tabId === 'didactiek') {
    return `
      <div style="background:#f0f9ff;border-left:3px solid var(--accent);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--ink-muted)">
        <strong style="color:var(--accent)">Vraag 2:</strong> Hoe kan ik dat bereiken, zó dat alle leerlingen actief meedoen? (aansluiting belevingswereld — betekenis geven — docentrollen — activerende didactiek)
      </div>
      <div class="form-field" style="margin-bottom:14px">
        <label style="font-weight:600">Wat doe ik? (en waarom)</label>
        <p style="font-size:12px;color:var(--ink-muted);margin:2px 0 6px">Beschrijf je aanpak als docent: hoe open je de les, welke werkvormen gebruik je, hoe begeleid je?</p>
        <textarea id="lb-watdoeik" rows="5" class="lb-textarea" ${ro?'readonly':''} placeholder="bijv. Ik start met een herkenbaar praktijkvoorbeeld om voorkennis te activeren. Via gerichte vragen laat ik leerlingen zelf verbanden leggen...">${escHtml(d.watDoekIk||'')}</textarea>
      </div>
      <div class="form-field">
        <label style="font-weight:600">Wat doet de leerling? (waartoe)</label>
        <p style="font-size:12px;color:var(--ink-muted);margin:2px 0 6px">Beschrijf wat leerlingen doen en wat het doel daarvan is.</p>
        <textarea id="lb-watdoetll" rows="5" class="lb-textarea" ${ro?'readonly':''} placeholder="bijv. Leerlingen denken mee, herkennen begrippen, verwerken technische termen in hun schema...">${escHtml(d.watDoetDeLeerling||'')}</textarea>
      </div>`;
  }

  // ---- EVALUATIE ----
  if (tabId === 'evaluatie') {
    return `
      <div style="background:#f0f9ff;border-left:3px solid var(--accent);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--ink-muted)">
        <strong style="color:var(--accent)">Vraag 3:</strong> Hoe controleer en evalueer ik of leerlingen geleerd hebben wat ik ze wilde leren? (per les — afsluiter — toetsing)
      </div>
      <div class="form-field">
        <label style="font-weight:600">Evaluatie</label>
        <p style="font-size:12px;color:var(--ink-muted);margin:2px 0 6px">Hoe check je tijdens en na de les of de leerdoelen bereikt zijn?</p>
        <textarea id="lb-evaluatie" rows="8" class="lb-textarea" ${ro?'readonly':''} placeholder="bijv. Tijdens de uitleg stel ik vragen en observeer ik reacties.&#10;Ik luister goed tijdens zelfstandig werken naar hoe leerlingen hun werk verwoorden.&#10;Als leerlingen kunnen uitleggen wat ze doen en waarom, weet ik dat de begrippen zijn blijven hangen.">${escHtml(d.evaluatie||'')}</textarea>
      </div>`;
  }

  // ---- REFLECTIE ----
  if (tabId === 'reflectie') {
    return `
      <div style="background:#f0f9ff;border-left:3px solid var(--accent);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--ink-muted)">
        <strong style="color:var(--accent)">Vraag 4:</strong> Wat wil ik laten zien? Resultaat: wat moet de assessoren zien? — wat heb ik nodig om resultaat te bereiken? — reflectie op eigen handelen.
      </div>
      <div class="form-field">
        <label style="font-weight:600">Resultaat & Reflectie</label>
        <p style="font-size:12px;color:var(--ink-muted);margin:2px 0 6px">Wat wil je demonstreren als docent? Hoe reflecteer je op je eigen handelen?</p>
        <textarea id="lb-reflectie" rows="8" class="lb-textarea" ${ro?'readonly':''} placeholder="bijv. Ik wil laten zien dat ik taalsteun kan bieden in een technische les. Ik gebruik heldere taal, herhaal en verklaar vakbegrippen, en help leerlingen deze woorden te gebruiken...">${escHtml(d.reflectie||'')}</textarea>
      </div>`;
  }

  // ---- FASERING ----
  if (tabId === 'fasering') {
    const fases = d.fasering && d.fasering.length ? d.fasering : lbLeeg().fasering;
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin:0 0 12px">Lesplan per fase: wat doe je als docent, wat verwacht je van de leerlingen, welke hulpmiddelen gebruik je?</p>
      <div style="overflow-x:auto">
        <table class="lb-fase-tabel">
          <thead>
            <tr>
              <th style="width:22%">Fasering van de les</th>
              <th style="width:12%">Tijd</th>
              <th style="width:24%">Activiteit leraar</th>
              <th style="width:24%">Activiteit leerlingen</th>
              <th style="width:18%">Hulpmiddelen</th>
              ${!ro ? '<th style="width:32px"></th>' : ''}
            </tr>
          </thead>
          <tbody id="lb-fasering-tbody">
            ${fases.map((f, i) => lbFaseRijHtml(f, i, ro)).join('')}
          </tbody>
        </table>
      </div>
      ${!ro ? `<button class="btn btn-sm" style="margin-top:10px" onclick="lbVoegFaseToe()">+ Fase toevoegen</button>` : ''}`;
  }

  return '';
}

function lbFaseRijHtml(f, i, ro) {
  if (ro) {
    return `<tr>
      <td style="font-weight:600;font-size:12px">${escHtml(f.fase||'')}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--ink-muted)">${escHtml(f.tijd||'')}</td>
      <td>${escHtml(f.activiteitLeraar||'')}</td>
      <td>${escHtml(f.activiteitLeerling||'')}</td>
      <td>${escHtml(f.hulpmiddelen||'')}</td>
    </tr>`;
  }
  return `<tr id="lb-fase-rij-${i}">
    <td><input class="lb-td-input" id="lb-f-fase-${i}" value="${escHtml(f.fase||'')}" placeholder="Fase naam"></td>
    <td><input class="lb-td-input" id="lb-f-tijd-${i}" value="${escHtml(f.tijd||'')}" placeholder="0:00–10:00" style="width:90px"></td>
    <td><textarea class="lb-td-input" id="lb-f-leraar-${i}" placeholder="Wat doe ik..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${escHtml(f.activiteitLeraar||'')}</textarea></td>
    <td><textarea class="lb-td-input" id="lb-f-leerling-${i}" placeholder="Wat doen leerlingen..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${escHtml(f.activiteitLeerling||'')}</textarea></td>
    <td><input class="lb-td-input" id="lb-f-hulp-${i}" value="${escHtml(f.hulpmiddelen||'')}" placeholder="bijv. Digibord"></td>
    <td><button onclick="lbVerwijderFase(${i})" class="lb-del-btn">✕</button></td>
  </tr>`;
}

// ============================================================
// DATA LEZEN UIT DOM
// ============================================================
function lbLeesData() {
  const d = _lb.data;
  const t = LB_STAPPEN[_lb.stap - 1]?.id;

  if (t === 'identificatie') {
    d.kandidaat           = document.getElementById('lb-kandidaat')?.value?.trim() || '';
    d.datumLes            = document.getElementById('lb-datuml')?.value?.trim() || '';
    d.werkplekbegeleider  = document.getElementById('lb-wpb')?.value?.trim() || '';
    d.vak                 = document.getElementById('lb-vak')?.value?.trim() || '';
    d.klas                = document.getElementById('lb-klas')?.value?.trim() || '';
    d.school              = document.getElementById('lb-school')?.value?.trim() || '';
    d.lokaal              = document.getElementById('lb-lokaal')?.value?.trim() || '';
    d.onderwerp           = document.getElementById('lb-onderwerp')?.value?.trim() || '';
    d.methode             = document.getElementById('lb-methode')?.value?.trim() || '';
  } else if (t === 'lesdoel') {
    d.lesdoel       = document.getElementById('lb-lesdoel')?.value?.trim() || '';
    d.beginsituatie = document.getElementById('lb-beginsituatie')?.value?.trim() || '';
  } else if (t === 'didactiek') {
    d.watDoekIk          = document.getElementById('lb-watdoeik')?.value?.trim() || '';
    d.watDoetDeLeerling  = document.getElementById('lb-watdoetll')?.value?.trim() || '';
  } else if (t === 'evaluatie') {
    d.evaluatie = document.getElementById('lb-evaluatie')?.value?.trim() || '';
  } else if (t === 'reflectie') {
    d.reflectie = document.getElementById('lb-reflectie')?.value?.trim() || '';
  } else if (t === 'fasering') {
    const fases = [];
    let i = 0;
    while (document.getElementById(`lb-f-fase-${i}`) !== null) {
      fases.push({
        fase:             document.getElementById(`lb-f-fase-${i}`)?.value?.trim() || '',
        tijd:             document.getElementById(`lb-f-tijd-${i}`)?.value?.trim() || '',
        activiteitLeraar: document.getElementById(`lb-f-leraar-${i}`)?.value?.trim() || '',
        activiteitLeerling: document.getElementById(`lb-f-leerling-${i}`)?.value?.trim() || '',
        hulpmiddelen:     document.getElementById(`lb-f-hulp-${i}`)?.value?.trim() || '',
      });
      i++;
    }
    d.fasering = fases;
  }
}

// ============================================================
// RIJEN TOEVOEGEN / VERWIJDEREN (fasering)
// ============================================================
function lbVoegFaseToe() {
  lbLeesData();
  const n = (_lb.data.fasering || []).length + 1;
  _lb.data.fasering.push({
    fase: 'Fase ' + n, tijd: '', activiteitLeraar: '', activiteitLeerling: '', hulpmiddelen: ''
  });
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('fasering', false);
  lbAutoResizeFasering();
}

function lbVerwijderFase(i) {
  lbLeesData();
  _lb.data.fasering.splice(i, 1);
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('fasering', false);
}

// ============================================================
// OPSLAAN
// ============================================================
async function lbOpslaan() {
  lbLeesData();
  const statusEl = document.getElementById('lb-opslaan-status');
  const btn = document.getElementById('lb-opslaan-btn');
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--amber)">⏳ Opslaan...</span>`;
  if (btn) btn.disabled = true;

  const info = _lb.activiteitInfo || {};
  const payload = {
    profielId: _lb.profielId || null,
    weekIdx: _lb.weekIdx ?? null,
    actIdx: _lb.actIdx ?? null,
    opdrachtId: _lb.opdrachtId || null,
    activiteitNaam: info.omschrijving || info.naam || '',
    activiteitType: info.type || '',
    activiteitUren: info.uren || 1,
    data: _lb.data,
  };

  try {
    let isNieuw = !_lb.id;
    if (_lb.id) {
      await fetch(`/api/lesbrieven/${_lb.id}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      const res = await fetch('/api/lesbrieven', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.id) _lb.id = data.id;
    }
    // Na opslaan altijd overzicht tonen
    setTimeout(() => lbToonOverzicht(), 400);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// DOWNLOAD
// ============================================================
function lbDownload() {
  if (!_lb.id) return;
  window.open(`/api/lesbrieven/${_lb.id}/download`, '_blank');
}

// ============================================================
// AI INVULLEN
// ============================================================
async function lbGenereerAI() {
  const statusEl = document.getElementById('lb-ai-status');
  const btn = document.getElementById('lb-ai-btn');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--amber)">✨ AI vult lesbrief in... (20-40 sec)</span>`;

  const info = _lb.activiteitInfo || {};
  try {
    const res = await fetch('/api/lesbrieven/genereer', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activiteitNaam: info.omschrijving || info.naam || '',
        activiteitType: info.type || '',
        activiteitUren: info.uren || 1,
        profielNaam: info.profielNaam || '',
        weekThema: info.weekThema || '',
        syllabuscodes: info.syllabus || '',
        niveau: info.niveau || _lb.data.klas || '',
        vak: info.vak || _lb.data.vak || '',
        huidigData: _lb.data,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');

    _lb.data = { ..._lb.data, ...data.data };
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ AI heeft de lesbrief ingevuld. Controleer en sla op.</span>`;
    document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab(LB_STAPPEN[_lb.stap - 1].id, false);
    if (LB_STAPPEN[_lb.stap - 1].id === 'fasering') lbAutoResizeFasering();
  } catch (e) {
    const isQuota = e.message.includes('AI_QUOTA') || e.message.includes('quota');
    if (statusEl) statusEl.innerHTML = isQuota
      ? `<span style="color:var(--amber)">AI quota bereikt. Vul de lesbrief handmatig in.</span>`
      : `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

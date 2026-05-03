// ============================================================
// public/js/views/lesbrieven.js
// Wizard-stijl navigatie (6 stappen) — zelfde stijl als toets/werkboekje wizard
// ============================================================

const _lb = {
  id: null,
  profielId: null,
  weekIdx: null,
  actIdx: null,
  activiteitInfo: null,
  data: null,
  stap: 1,
  opgeslagen: true,
};

// ============================================================
// ENTRY POINT
// ============================================================
async function openLesbrief(profielId, weekIdx, actIdx, activiteitInfo) {
  _lb.profielId = profielId;
  _lb.weekIdx = weekIdx;
  _lb.actIdx = actIdx;
  _lb.activiteitInfo = activiteitInfo || {};
  _lb.stap = 1;
  _lb.opgeslagen = true;

  try {
    const res = await fetch(`/api/lesbrieven?profielId=${profielId}&weekIdx=${weekIdx}&actIdx=${actIdx}`, { credentials: 'same-origin' });
    const lijst = await res.json();
    if (lijst && lijst.length > 0) {
      _lb.data = lijst[0];
      _lb.id = lijst[0].id;
    } else {
      _lb.id = null;
      _lb.data = lbLeeg();
    }
  } catch {
    _lb.id = null;
    _lb.data = lbLeeg();
  }

  renderLb();
}

function lbLeeg() {
  return {
    voorbereiding: '',
    benodigdheden: [],
    lesverloop: [],
    stappenplan: [],
    aandachtspunten: [],
    differentiatie: { snel: '', langzaam: '' },
    opmerkingen: '',
  };
}

// ============================================================
// STAPPEN DEFINITIES
// ============================================================
const LB_STAPPEN = [
  { id: 'voorbereiding',    label: 'Voorbereiding' },
  { id: 'lesverloop',       label: 'Lesverloop' },
  { id: 'stappenplan',      label: 'Stappenplan' },
  { id: 'aandachtspunten',  label: 'Aandachtspunten' },
  { id: 'differentiatie',   label: 'Differentiatie' },
  { id: 'opmerkingen',      label: 'Opmerkingen' },
];

// ============================================================
// RENDER MODAL — wizard-stijl
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
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:10px">
        <div>
          <h2 style="margin:0 0 4px;font-size:18px">📄 Lesbrief — stap ${s} van ${totaal}: ${huidigLabel}</h2>
          <div style="font-size:13px;color:var(--ink-muted)">
            ${info.type ? `<span style="background:var(--accent-dim);color:var(--accent);border-radius:4px;padding:1px 7px;font-size:12px;font-weight:600;margin-right:6px">${escHtml(info.type)}</span>` : ''}
            ${escHtml(info.omschrijving || info.naam || '')}${info.uren ? ` · ${info.uren} uur` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${!ro ? `<button class="btn btn-sm" onclick="lbGenereerAI()" id="lb-ai-btn">✨ AI invullen</button>` : ''}
          ${!ro ? `<button class="btn btn-sm" onclick="lbOpslaan()" id="lb-opslaan-btn">💾 Opslaan</button>` : ''}
        </div>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:16px">
        <div style="display:flex;gap:4px;margin-bottom:6px">
          ${LB_STAPPEN.map((_, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i < s ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--ink-muted)">Stap ${s} van ${totaal}</div>
      </div>

      <div id="lb-ai-status" style="font-size:13px;margin-bottom:8px"></div>

      <!-- Stap inhoud -->
      <div id="lb-tab-inhoud">
        ${lbRenderTab(huidigId, ro)}
      </div>

      <div id="lb-opslaan-status" style="font-size:13px;margin-top:8px"></div>

      <!-- Navigatie -->
      <div class="modal-actions">
        ${s === 1
          ? `<button class="btn" onclick="closeModalDirect()">Sluiten</button>`
          : `<button class="btn" onclick="lbVorigeStap()">← Vorige</button>`
        }
        ${s < totaal
          ? `<button class="btn btn-primary" onclick="lbVolgendeStap()">Volgende →</button>`
          : `
            ${_lb.id ? `<button class="btn btn-sm" onclick="lbDownload()">⬇ Download</button>` : ''}
            <button class="btn" onclick="closeModalDirect()">Sluiten</button>
          `
        }
      </div>
    </div>
  `);

  setTimeout(() => {
    const box = document.querySelector('#modal-overlay .modal-box');
    if (box) box.style.maxWidth = '860px';
    lbInjectStijlen();
    if (huidigId === 'lesverloop') {
      document.querySelectorAll('[id^="lb-lv-beschr-"]').forEach(el => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      });
    }
  }, 0);
}

function lbInjectStijlen() {
  if (document.getElementById('lb-stijlen')) return;
  const s = document.createElement('style');
  s.id = 'lb-stijlen';
  s.textContent = `
    .lb-textarea {
      width:100%;padding:8px 10px;border:1.5px solid var(--border);
      border-radius:var(--radius-sm);font-size:13px;font-family:inherit;
      box-sizing:border-box;resize:vertical;
    }
    .lb-textarea:focus { outline:none;border-color:var(--accent); }
    .lb-input {
      padding:6px 9px;border:1.5px solid var(--border);
      border-radius:var(--radius-sm);font-size:13px;font-family:inherit;
      box-sizing:border-box;
    }
    .lb-input:focus { outline:none;border-color:var(--accent); }
    .lb-del-btn { color:var(--red);border:none;background:none;cursor:pointer;font-size:14px;padding:3px 4px;flex-shrink:0; }
    .lb-fase-rij { border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px;background:#FAFAFA; }
  `;
  document.head.appendChild(s);
}

// ============================================================
// WIZARD NAVIGATIE
// ============================================================
function lbVorigeStap() {
  lbLeesData();
  _lb.stap--;
  renderLb();
}

function lbVolgendeStap() {
  lbLeesData();
  _lb.stap++;
  renderLb();
}

// ============================================================
// STAP INHOUD
// ============================================================
function lbRenderTab(tabId, ro) {
  const d = _lb.data;

  // ---- VOORBEREIDING ----
  if (tabId === 'voorbereiding') {
    const bens = d.benodigdheden && d.benodigdheden.length ? d.benodigdheden : [''];
    return `
      <div class="form-field">
        <label style="font-weight:600">Voorbereiding</label>
        <p style="font-size:12px;color:var(--ink-muted);margin-bottom:6px">Wat moet de docent regelen vóór de les?</p>
        <textarea id="lb-voorbereiding" rows="4" ${ro ? 'readonly' : ''} class="lb-textarea"
          placeholder="bijv. Zorg dat alle computers aan staan, materialen klaarliggen...">${escHtml(d.voorbereiding || '')}</textarea>
      </div>
      <div class="form-field" style="margin-top:14px">
        <label style="font-weight:600">Benodigdheden</label>
        <div id="lb-benodigdheden-lijst" style="margin-top:6px">
          ${bens.map((b, i) => `
            <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
              <span style="font-size:13px;color:var(--ink-muted);min-width:20px;text-align:right">${i + 1}.</span>
              <input id="lb-ben-${i}" value="${escHtml(b)}" ${ro ? 'readonly' : ''}
                placeholder="Benodigdheid..." class="lb-input" style="flex:1">
              ${!ro ? `<button onclick="lbVerwijderBen(${i})" class="lb-del-btn">✕</button>` : ''}
            </div>`).join('')}
        </div>
        ${!ro ? `<button class="btn btn-sm" onclick="lbVoegBenToe()" style="margin-top:2px">+ Toevoegen</button>` : ''}
      </div>`;
  }

  // ---- LESVERLOOP ----
  if (tabId === 'lesverloop') {
    const fases = d.lesverloop && d.lesverloop.length ? d.lesverloop :
      [{ fase: 'Introductie', minuten: 10, beschrijving: '' },
       { fase: 'Instructie',  minuten: 20, beschrijving: '' },
       { fase: 'Verwerking',  minuten: 30, beschrijving: '' },
       { fase: 'Afsluiting',  minuten: 5,  beschrijving: '' }];
    const totaal = fases.reduce((t, f) => t + (parseInt(f.minuten) || 0), 0);
    const beschikbaar = _lb.activiteitInfo?.uren ? Math.round(_lb.activiteitInfo.uren * 45) : null;
    return `
      <div style="font-size:13px;color:var(--ink-muted);margin-bottom:12px">
        Totaal: <strong>${totaal} minuten</strong>
        ${beschikbaar ? ` · Beschikbaar: <strong>${beschikbaar} minuten</strong>` : ''}
      </div>
      <div id="lb-lesverloop-lijst">
        ${fases.map((f, i) => `
          <div class="lb-fase-rij">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
              <input id="lb-lv-fase-${i}" value="${escHtml(f.fase || '')}" ${ro ? 'readonly' : ''}
                placeholder="Fase naam" class="lb-input" style="flex:1;min-width:100px;font-weight:600">
              <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                <input id="lb-lv-min-${i}" type="number" min="1" max="240" value="${f.minuten || 10}" ${ro ? 'readonly' : ''}
                  class="lb-input" style="width:58px;text-align:center">
                <span style="font-size:12px;color:var(--ink-muted)">min</span>
              </div>
              ${!ro ? `<button onclick="lbVerwijderFase(${i})" class="lb-del-btn">✕</button>` : ''}
            </div>
            <textarea id="lb-lv-beschr-${i}" ${ro ? 'readonly' : ''}
              placeholder="Wat doet de docent in deze fase..."
              class="lb-textarea" style="font-size:12px"
              oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
              rows="${Math.max(2, Math.ceil((f.beschrijving || '').length / 80))}"
              >${escHtml(f.beschrijving || '')}</textarea>
          </div>`).join('')}
      </div>
      ${!ro ? `<button class="btn btn-sm" onclick="lbVoegFaseToe()">+ Fase toevoegen</button>` : ''}`;
  }

  // ---- STAPPENPLAN ----
  if (tabId === 'stappenplan') {
    const stappen = d.stappenplan && d.stappenplan.length ? d.stappenplan : [{ stap: 1, instructie: '' }];
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:12px">Concrete stap-voor-stap instructie voor de docent.</p>
      <div id="lb-stappenplan-lijst">
        ${stappen.map((s, i) => `
          <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-start">
            <div style="min-width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;flex-shrink:0">${i + 1}</div>
            <textarea id="lb-sp-${i}" rows="2" ${ro ? 'readonly' : ''}
              placeholder="Instructie voor de docent..."
              class="lb-textarea" style="flex:1">${escHtml(s.instructie || '')}</textarea>
            ${!ro ? `<button onclick="lbVerwijderStap(${i})" class="lb-del-btn" style="margin-top:4px">✕</button>` : ''}
          </div>`).join('')}
      </div>
      ${!ro ? `<button class="btn btn-sm" onclick="lbVoegStapToe()">+ Stap toevoegen</button>` : ''}`;
  }

  // ---- AANDACHTSPUNTEN ----
  if (tabId === 'aandachtspunten') {
    const punten = d.aandachtspunten && d.aandachtspunten.length ? d.aandachtspunten : [''];
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:12px">Veiligheidsaandachtspunten, didactische tips en aandachtige leerlingen.</p>
      <div id="lb-aandacht-lijst">
        ${punten.map((p, i) => `
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <span style="font-size:16px;flex-shrink:0">⚠️</span>
            <input id="lb-ap-${i}" value="${escHtml(p)}" ${ro ? 'readonly' : ''}
              placeholder="Aandachtspunt of tip..."
              class="lb-input" style="flex:1">
            ${!ro ? `<button onclick="lbVerwijderAP(${i})" class="lb-del-btn">✕</button>` : ''}
          </div>`).join('')}
      </div>
      ${!ro ? `<button class="btn btn-sm" onclick="lbVoegAPToe()">+ Aandachtspunt toevoegen</button>` : ''}`;
  }

  // ---- DIFFERENTIATIE ----
  if (tabId === 'differentiatie') {
    const diff = d.differentiatie || { snel: '', langzaam: '' };
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:14px">Tips voor leerlingen die snel of juist langzamer werken.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:#DEF7EC;color:#065F46;border-radius:4px;padding:2px 8px;font-size:12px">Snel klaar</span>
          </label>
          <textarea id="lb-diff-snel" rows="6" ${ro ? 'readonly' : ''}
            placeholder="bijv. Verdiepingsopdracht maken, andere leerling helpen..."
            class="lb-textarea">${escHtml(diff.snel || '')}</textarea>
        </div>
        <div>
          <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:12px">Extra tijd</span>
          </label>
          <textarea id="lb-diff-langzaam" rows="6" ${ro ? 'readonly' : ''}
            placeholder="bijv. Minder opdrachten, extra uitleg geven..."
            class="lb-textarea">${escHtml(diff.langzaam || '')}</textarea>
        </div>
      </div>`;
  }

  // ---- OPMERKINGEN ----
  if (tabId === 'opmerkingen') {
    return `
      <label style="font-weight:600">Opmerkingen</label>
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:8px">Vrije notities voor de docent.</p>
      <textarea id="lb-opmerkingen" rows="10" ${ro ? 'readonly' : ''}
        class="lb-textarea"
        placeholder="Vrije notities, ervaringen, aanpassingen voor volgende keer...">${escHtml(d.opmerkingen || '')}</textarea>`;
  }

  return '';
}

// ============================================================
// DATA LEZEN UIT DOM
// ============================================================
function lbLeesData() {
  const d = _lb.data;
  const t = LB_STAPPEN[_lb.stap - 1]?.id;

  if (t === 'voorbereiding') {
    d.voorbereiding = document.getElementById('lb-voorbereiding')?.value || '';
    const bens = [];
    let i = 0;
    while (document.getElementById(`lb-ben-${i}`)) {
      const v = document.getElementById(`lb-ben-${i}`).value.trim();
      if (v) bens.push(v);
      i++;
    }
    d.benodigdheden = bens;
  } else if (t === 'lesverloop') {
    const fases = [];
    let i = 0;
    while (document.getElementById(`lb-lv-fase-${i}`)) {
      fases.push({
        fase: document.getElementById(`lb-lv-fase-${i}`).value.trim(),
        minuten: parseInt(document.getElementById(`lb-lv-min-${i}`)?.value) || 0,
        beschrijving: document.getElementById(`lb-lv-beschr-${i}`)?.value.trim() || '',
      });
      i++;
    }
    d.lesverloop = fases;
  } else if (t === 'stappenplan') {
    const stappen = [];
    let i = 0;
    while (document.getElementById(`lb-sp-${i}`)) {
      const v = document.getElementById(`lb-sp-${i}`).value.trim();
      if (v) stappen.push({ stap: i + 1, instructie: v });
      i++;
    }
    d.stappenplan = stappen;
  } else if (t === 'aandachtspunten') {
    const punten = [];
    let i = 0;
    while (document.getElementById(`lb-ap-${i}`)) {
      const v = document.getElementById(`lb-ap-${i}`).value.trim();
      if (v) punten.push(v);
      i++;
    }
    d.aandachtspunten = punten;
  } else if (t === 'differentiatie') {
    d.differentiatie = {
      snel: document.getElementById('lb-diff-snel')?.value.trim() || '',
      langzaam: document.getElementById('lb-diff-langzaam')?.value.trim() || '',
    };
  } else if (t === 'opmerkingen') {
    d.opmerkingen = document.getElementById('lb-opmerkingen')?.value || '';
  }
}

// ============================================================
// RIJEN TOEVOEGEN / VERWIJDEREN
// ============================================================
function lbVoegBenToe() {
  lbLeesData();
  _lb.data.benodigdheden.push('');
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('voorbereiding', false);
}
function lbVerwijderBen(i) {
  lbLeesData();
  _lb.data.benodigdheden.splice(i, 1);
  if (!_lb.data.benodigdheden.length) _lb.data.benodigdheden = [''];
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('voorbereiding', false);
}
function lbVoegFaseToe() {
  lbLeesData();
  _lb.data.lesverloop.push({ fase: 'Nieuwe fase', minuten: 10, beschrijving: '' });
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('lesverloop', false);
}
function lbVerwijderFase(i) {
  lbLeesData();
  _lb.data.lesverloop.splice(i, 1);
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('lesverloop', false);
}
function lbVoegStapToe() {
  lbLeesData();
  _lb.data.stappenplan.push({ stap: _lb.data.stappenplan.length + 1, instructie: '' });
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('stappenplan', false);
}
function lbVerwijderStap(i) {
  lbLeesData();
  _lb.data.stappenplan.splice(i, 1);
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('stappenplan', false);
}
function lbVoegAPToe() {
  lbLeesData();
  _lb.data.aandachtspunten.push('');
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('aandachtspunten', false);
}
function lbVerwijderAP(i) {
  lbLeesData();
  _lb.data.aandachtspunten.splice(i, 1);
  if (!_lb.data.aandachtspunten.length) _lb.data.aandachtspunten = [''];
  document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab('aandachtspunten', false);
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
    profielId: _lb.profielId,
    weekIdx: _lb.weekIdx,
    actIdx: _lb.actIdx,
    activiteitNaam: info.omschrijving || info.naam || '',
    activiteitType: info.type || '',
    activiteitUren: info.uren || 1,
    ..._lb.data,
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
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ Opgeslagen</span>`;
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 2000);
    if (isNieuw && _lb.id) renderLb();
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
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Onbekende fout');

    _lb.data = { ..._lb.data, ...data.data };
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ AI heeft de lesbrief ingevuld. Controleer en sla op.</span>`;
    document.getElementById('lb-tab-inhoud').innerHTML = lbRenderTab(LB_STAPPEN[_lb.stap - 1].id, false);
  } catch (e) {
    const isQuota = e.message.includes('AI_QUOTA') || e.message.includes('quota');
    if (statusEl) statusEl.innerHTML = isQuota
      ? `<span style="color:var(--amber)">AI quota bereikt. Vul de lesbrief handmatig in.</span>`
      : `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

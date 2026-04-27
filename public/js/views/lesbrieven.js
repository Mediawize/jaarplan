// ============================================================
// public/js/views/lesbrieven.js
// Lesbrief modal met tabs: Voorbereiding, Lesverloop,
// Stappenplan, Aandachtspunten, Differentiatie, Opmerkingen
// ============================================================

// Huidige staat van de open lesbrief
const _lb = {
  id: null,
  profielId: null,
  weekIdx: null,
  actIdx: null,
  activiteitInfo: null,
  data: null,
  actieveTab: 'voorbereiding',
  opgeslagen: true,
};

// ============================================================
// ENTRY POINT — open lesbrief voor een activiteit
// Aanroepen vanuit lesprofielen.js, jaarplanning.js, dashboard
// ============================================================
async function openLesbrief(profielId, weekIdx, actIdx, activiteitInfo) {
  _lb.profielId = profielId;
  _lb.weekIdx = weekIdx;
  _lb.actIdx = actIdx;
  _lb.activiteitInfo = activiteitInfo || {};
  _lb.actieveTab = 'voorbereiding';
  _lb.opgeslagen = true;

  // Laad bestaande lesbrief of maak leeg object
  try {
    const res = await fetch(`/api/lesbrieven?profielId=${profielId}&weekIdx=${weekIdx}&actIdx=${actIdx}`, { credentials: 'same-origin' });
    const lijst = await res.json();
    if (lijst && lijst.length > 0) {
      _lb.data = lijst[0];
      _lb.id = lijst[0].id;
    } else {
      _lb.id = null;
      _lb.data = lesbriefLeegObject();
    }
  } catch {
    _lb.id = null;
    _lb.data = lesbriefLeegObject();
  }

  renderLesbriefModal();
}

function lesbriefLeegObject() {
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
// RENDER MODAL
// ============================================================
function renderLesbriefModal() {
  const info = _lb.activiteitInfo || {};
  const readonly = !Auth.canEdit();
  const tabs = [
    { id: 'voorbereiding', label: 'Voorbereiding', icon: '📋' },
    { id: 'lesverloop',    label: 'Lesverloop',    icon: '⏱️' },
    { id: 'stappenplan',   label: 'Stappenplan',   icon: '📝' },
    { id: 'aandachtspunten', label: 'Aandachtspunten', icon: '⚠️' },
    { id: 'differentiatie',  label: 'Differentiatie',  icon: '⭐' },
    { id: 'opmerkingen',     label: 'Opmerkingen',     icon: '💬' },
  ];

  const tabHTML = tabs.map(t => `
    <button onclick="lbWisselTab('${t.id}')" id="lb-tab-${t.id}"
      style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;border-bottom:2px solid ${_lb.actieveTab === t.id ? 'var(--accent)' : 'transparent'};color:${_lb.actieveTab === t.id ? 'var(--accent)' : 'var(--ink-muted)'};white-space:nowrap;transition:color .15s">
      <span>${t.icon}</span>${t.label}
    </button>
  `).join('');

  openModal(`
    <div style="margin:-4px -4px 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:0 0 12px 0;gap:12px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0 0 4px">📄 Lesbrief</h2>
          <div style="font-size:13px;color:var(--ink-muted)">
            ${escHtml(info.type || 'Activiteit')} — ${escHtml(info.omschrijving || info.naam || '')}
            ${info.uren ? `· ${info.uren} uur` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${!readonly ? `
            <button class="btn btn-sm" onclick="lbGenereerAI()" id="lb-ai-btn">✨ AI invullen</button>
            <button class="btn btn-sm btn-primary" onclick="lbOpslaan()" id="lb-opslaan-btn">Opslaan</button>
          ` : ''}
          <button class="btn btn-sm" onclick="closeModalDirect()">Sluiten</button>
        </div>
      </div>

      <div id="lb-ai-status" style="font-size:13px;margin-bottom:8px"></div>

      <!-- Tabs -->
      <div style="display:flex;gap:0;overflow-x:auto;border-bottom:1px solid var(--border);margin-bottom:16px;-webkit-overflow-scrolling:touch">
        ${tabHTML}
      </div>

      <!-- Tab inhoud -->
      <div id="lb-tab-inhoud">
        ${renderLesbriefTab(_lb.actieveTab, readonly)}
      </div>

      <div id="lb-opslaan-status" style="font-size:13px;margin-top:8px;text-align:right"></div>
    </div>
  `, { breed: true });
}

// ============================================================
// TAB INHOUD RENDEREN
// ============================================================
function renderLesbriefTab(tabId, readonly) {
  const d = _lb.data;
  const ro = readonly;

  if (tabId === 'voorbereiding') {
    const bens = d.benodigdheden && d.benodigdheden.length ? d.benodigdheden : [''];
    return `
      <div class="form-field">
        <label style="font-weight:600">Voorbereiding</label>
        <p style="font-size:12px;color:var(--ink-muted);margin-bottom:6px">Wat moet de docent regelen vóór de les?</p>
        <textarea id="lb-voorbereiding" rows="4" ${ro ? 'readonly' : ''}
          style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:vertical"
          placeholder="bijv. Zorg dat alle computers aan staan, materialen klaarliggen...">${escHtml(d.voorbereiding || '')}</textarea>
      </div>
      <div class="form-field" style="margin-top:12px">
        <label style="font-weight:600">Benodigdheden</label>
        <div id="lb-benodigdheden-lijst">
          ${bens.map((b, i) => `
            <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
              <span style="font-size:13px;color:var(--ink-muted);min-width:20px">${i + 1}.</span>
              <input id="lb-ben-${i}" value="${escHtml(b)}" ${ro ? 'readonly' : ''}
                placeholder="Benodigdheid..." style="flex:1;padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px">
              ${!ro ? `<button onclick="lbVerwijderBen(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:16px;padding:4px">✕</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${!ro ? `<button class="btn btn-sm" onclick="lbVoegBenToe()" style="margin-top:4px">+ Toevoegen</button>` : ''}
      </div>
    `;
  }

  if (tabId === 'lesverloop') {
    const fases = d.lesverloop && d.lesverloop.length ? d.lesverloop :
      [{ fase: 'Introductie', minuten: 10, beschrijving: '' },
       { fase: 'Instructie', minuten: 20, beschrijving: '' },
       { fase: 'Verwerking', minuten: 30, beschrijving: '' },
       { fase: 'Afsluiting', minuten: 5, beschrijving: '' }];
    const totaal = fases.reduce((t, f) => t + (parseInt(f.minuten) || 0), 0);
    return `
      <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">
        Totaal: <strong>${totaal} minuten</strong>
        ${_lb.activiteitInfo?.uren ? ` · Beschikbaar: <strong>${Math.round(_lb.activiteitInfo.uren * 60)} minuten</strong>` : ''}
      </div>
      <div id="lb-lesverloop-lijst">
        ${fases.map((f, i) => `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
              <input id="lb-lv-fase-${i}" value="${escHtml(f.fase || '')}" ${ro ? 'readonly' : ''}
                placeholder="Fase naam" style="flex:1;min-width:100px;padding:5px 8px;border:1.5px solid var(--border);border-radius:4px;font-size:13px;font-weight:600">
              <div style="display:flex;align-items:center;gap:4px">
                <input id="lb-lv-min-${i}" type="number" min="1" max="240" value="${f.minuten || 10}" ${ro ? 'readonly' : ''}
                  style="width:60px;padding:5px 8px;border:1.5px solid var(--border);border-radius:4px;font-size:13px;text-align:center">
                <span style="font-size:12px;color:var(--ink-muted)">min</span>
              </div>
              ${!ro ? `<button onclick="lbVerwijderFase(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:14px">✕</button>` : ''}
            </div>
            <textarea id="lb-lv-beschr-${i}" rows="2" ${ro ? 'readonly' : ''}
              placeholder="Wat doet de docent in deze fase..."
              style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:4px;font-size:12px;resize:none">${escHtml(f.beschrijving || '')}</textarea>
          </div>
        `).join('')}
      </div>
      ${!ro ? `<button class="btn btn-sm" onclick="lbVoegFaseToe()">+ Fase toevoegen</button>` : ''}
    `;
  }

  if (tabId === 'stappenplan') {
    const stappen = d.stappenplan && d.stappenplan.length ? d.stappenplan : [{ stap: 1, instructie: '' }];
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">Concrete stap-voor-stap instructie voor de docent.</p>
      <div id="lb-stappenplan-lijst">
        ${stappen.map((s, i) => `
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start">
            <div style="min-width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-top:2px;flex-shrink:0">${i + 1}</div>
            <textarea id="lb-sp-${i}" rows="2" ${ro ? 'readonly' : ''}
              placeholder="Instructie voor de docent..."
              style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:vertical">${escHtml(s.instructie || '')}</textarea>
            ${!ro ? `<button onclick="lbVerwijderStap(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:16px;margin-top:2px">✕</button>` : ''}
          </div>
        `).join('')}
      </div>
      ${!ro ? `<button class="btn btn-sm" onclick="lbVoegStapToe()">+ Stap toevoegen</button>` : ''}
    `;
  }

  if (tabId === 'aandachtspunten') {
    const punten = d.aandachtspunten && d.aandachtspunten.length ? d.aandachtspunten : [''];
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">Veiligheidsaandachtspunten, didactische tips en aandachtige leerlingen.</p>
      <div id="lb-aandacht-lijst">
        ${punten.map((p, i) => `
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <span style="font-size:16px;flex-shrink:0">⚠️</span>
            <input id="lb-ap-${i}" value="${escHtml(p)}" ${ro ? 'readonly' : ''}
              placeholder="Aandachtspunt of tip..."
              style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px">
            ${!ro ? `<button onclick="lbVerwijderAP(${i})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:16px">✕</button>` : ''}
          </div>
        `).join('')}
      </div>
      ${!ro ? `<button class="btn btn-sm" onclick="lbVoegAPToe()">+ Aandachtspunt toevoegen</button>` : ''}
    `;
  }

  if (tabId === 'differentiatie') {
    const diff = d.differentiatie || { snel: '', langzaam: '' };
    return `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:12px">Tips voor leerlingen die snel of juist langzamer werken.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:#DEF7EC;color:#065F46;border-radius:4px;padding:2px 8px;font-size:12px">Snel</span>
            Voor leerlingen die snel klaar zijn
          </label>
          <textarea id="lb-diff-snel" rows="5" ${ro ? 'readonly' : ''}
            placeholder="bijv. Verdiepingsopdracht maken, andere leerling helpen..."
            style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:vertical">${escHtml(diff.snel || '')}</textarea>
        </div>
        <div>
          <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:#FEF3C7;color:#92400E;border-radius:4px;padding:2px 8px;font-size:12px">Extra tijd</span>
            Voor leerlingen die extra tijd nodig hebben
          </label>
          <textarea id="lb-diff-langzaam" rows="5" ${ro ? 'readonly' : ''}
            placeholder="bijv. Minder opdrachten, extra uitleg geven..."
            style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:vertical">${escHtml(diff.langzaam || '')}</textarea>
        </div>
      </div>
    `;
  }

  if (tabId === 'opmerkingen') {
    return `
      <div class="form-field">
        <label style="font-weight:600">Opmerkingen</label>
        <p style="font-size:12px;color:var(--ink-muted);margin-bottom:6px">Vrije notities voor de docent.</p>
        <textarea id="lb-opmerkingen" rows="8" ${ro ? 'readonly' : ''}
          style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px;resize:vertical"
          placeholder="Vrije notities, ervaringen, aanpassingen voor volgende keer...">${escHtml(d.opmerkingen || '')}</textarea>
      </div>
    `;
  }

  return '';
}

// ============================================================
// TAB WISSELEN — sla huidige tab op in _lb.data, render nieuwe
// ============================================================
function lbWisselTab(tabId) {
  lbLeesHuidigTab();
  _lb.actieveTab = tabId;
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab(tabId, !Auth.canEdit());
  // Update tab styling
  document.querySelectorAll('[id^="lb-tab-"]').forEach(btn => {
    const t = btn.id.replace('lb-tab-', '');
    if (!['voorbereiding','lesverloop','stappenplan','aandachtspunten','differentiatie','opmerkingen'].includes(t)) return;
    btn.style.borderBottomColor = t === tabId ? 'var(--accent)' : 'transparent';
    btn.style.color = t === tabId ? 'var(--accent)' : 'var(--ink-muted)';
  });
}

// ============================================================
// LEES HUIDIGE TAB WAARDEN → _lb.data
// ============================================================
function lbLeesHuidigTab() {
  const t = _lb.actieveTab;
  const d = _lb.data;

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
  }
  else if (t === 'lesverloop') {
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
  }
  else if (t === 'stappenplan') {
    const stappen = [];
    let i = 0;
    while (document.getElementById(`lb-sp-${i}`)) {
      const v = document.getElementById(`lb-sp-${i}`).value.trim();
      if (v) stappen.push({ stap: i + 1, instructie: v });
      i++;
    }
    d.stappenplan = stappen;
  }
  else if (t === 'aandachtspunten') {
    const punten = [];
    let i = 0;
    while (document.getElementById(`lb-ap-${i}`)) {
      const v = document.getElementById(`lb-ap-${i}`).value.trim();
      if (v) punten.push(v);
      i++;
    }
    d.aandachtspunten = punten;
  }
  else if (t === 'differentiatie') {
    d.differentiatie = {
      snel: document.getElementById('lb-diff-snel')?.value.trim() || '',
      langzaam: document.getElementById('lb-diff-langzaam')?.value.trim() || '',
    };
  }
  else if (t === 'opmerkingen') {
    d.opmerkingen = document.getElementById('lb-opmerkingen')?.value || '';
  }
}

// ============================================================
// DYNAMISCH RIJEN TOEVOEGEN/VERWIJDEREN
// ============================================================
function lbVoegBenToe() {
  lbLeesHuidigTab();
  _lb.data.benodigdheden.push('');
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('voorbereiding', false);
}
function lbVerwijderBen(i) {
  lbLeesHuidigTab();
  _lb.data.benodigdheden.splice(i, 1);
  if (!_lb.data.benodigdheden.length) _lb.data.benodigdheden = [''];
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('voorbereiding', false);
}

function lbVoegFaseToe() {
  lbLeesHuidigTab();
  _lb.data.lesverloop.push({ fase: 'Nieuwe fase', minuten: 10, beschrijving: '' });
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('lesverloop', false);
}
function lbVerwijderFase(i) {
  lbLeesHuidigTab();
  _lb.data.lesverloop.splice(i, 1);
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('lesverloop', false);
}

function lbVoegStapToe() {
  lbLeesHuidigTab();
  _lb.data.stappenplan.push({ stap: _lb.data.stappenplan.length + 1, instructie: '' });
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('stappenplan', false);
}
function lbVerwijderStap(i) {
  lbLeesHuidigTab();
  _lb.data.stappenplan.splice(i, 1);
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('stappenplan', false);
}

function lbVoegAPToe() {
  lbLeesHuidigTab();
  _lb.data.aandachtspunten.push('');
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('aandachtspunten', false);
}
function lbVerwijderAP(i) {
  lbLeesHuidigTab();
  _lb.data.aandachtspunten.splice(i, 1);
  if (!_lb.data.aandachtspunten.length) _lb.data.aandachtspunten = [''];
  document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab('aandachtspunten', false);
}

// ============================================================
// OPSLAAN
// ============================================================
async function lbOpslaan() {
  lbLeesHuidigTab();
  const statusEl = document.getElementById('lb-opslaan-status');
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--amber)">⏳ Opslaan...</span>`;

  const payload = {
    profielId: _lb.profielId,
    weekIdx: _lb.weekIdx,
    actIdx: _lb.actIdx,
    ..._lb.data,
  };

  try {
    let res;
    if (_lb.id) {
      res = await fetch(`/api/lesbrieven/${_lb.id}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/lesbrieven', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.id) _lb.id = data.id;
    }
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent)">✓ Opgeslagen</span>`;
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 2000);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  }
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

    // Merge AI data in _lb.data
    _lb.data = { ..._lb.data, ...data.data };
    statusEl.innerHTML = `<span style="color:var(--accent)">✓ AI heeft de lesbrief ingevuld. Controleer en sla op.</span>`;

    // Re-render huidige tab
    document.getElementById('lb-tab-inhoud').innerHTML = renderLesbriefTab(_lb.actieveTab, false);
  } catch (e) {
    const isQuota = e.message.includes('AI_QUOTA') || e.message.includes('quota');
    statusEl.innerHTML = isQuota
      ? `<span style="color:var(--amber)">AI quota bereikt. Vul de lesbrief handmatig in.</span>`
      : `<span style="color:var(--red)">Fout: ${escHtml(e.message)}</span>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}
